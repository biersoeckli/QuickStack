import { z } from "zod";
import { simpleRoute } from "@/server/utils/action-wrapper.utils";
import deploymentLogService from "@/server/services/deployment-logs.service";
import { StreamUtils } from "@/shared/utils/stream.utils";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const zodInputModel = z.object({
    deploymentId: z.string(),
});

export async function POST(request: Request) {
    return simpleRoute(async () => {
        const input = await request.json();

        const inputInfo = zodInputModel.parse(input);
        let { deploymentId } = inputInfo;

        let closeListenerFunc: (() => void) | undefined;

        const encoder = new TextEncoder();
        const customReadable = new ReadableStream({
            start(controller) {
                const innerFunc = async () => {
                    console.log(`[CONNECT] Client joined build log stream for deployment ${deploymentId}`);
                    controller.enqueue(encoder.encode(StreamUtils.encodeSseData('Stream opened, loading build logs...\n')));

                    closeListenerFunc = await deploymentLogService.getLogsStream(deploymentId, (chunk) => {
                        controller.enqueue(encoder.encode(StreamUtils.encodeSseData(chunk)));
                    });
                };
                innerFunc();
            },
            cancel() {
                console.log(`[DISCONNECTED] Client disconnected build log stream for deployment ${deploymentId}`);
                closeListenerFunc?.();
            },
        })

        return new Response(customReadable, {
            // Set the headers for Server-Sent Events (SSE)
            headers: {
                Connection: "keep-alive",
                "Content-Encoding": "none",
                "Cache-Control": "no-cache, no-transform",
                "Content-Type": "text/event-stream; charset=utf-8",
            },
        })
    });
}
