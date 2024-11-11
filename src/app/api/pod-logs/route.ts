import buildService, { buildNamespace } from "@/server/services/build.service";
import deploymentService from "@/server/services/deployment.service";
import { z } from "zod";
import stream from "stream";
import k3s from "@/server/adapter/kubernetes-api.adapter";
import { simpleAction, simpleRoute } from "@/server/utils/action-wrapper.utils";
import podService from "@/server/services/pod.service";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const zodInputModel = z.object({
    namespace: z.string().optional(),
    podName: z.string().optional(),
    buildJobName: z.string().optional(),
});

export async function POST(request: Request) {
    return simpleRoute(async () => {
        const input = await request.json();
        
        const podInfo = zodInputModel.parse(input);
        let { namespace, podName, buildJobName } = podInfo;
        let pod;
        let streamKey;
        if (namespace && podName) {
            pod = await deploymentService.getPodByName(namespace, podName);
            streamKey = `${namespace}_${podName}`;

        } else if (buildJobName) {
            namespace = buildNamespace;
            pod = await buildService.getPodForJob(buildJobName);
            streamKey = `${buildJobName}`;

        } else {
            console.error('Invalid pod info for streaming logs', podInfo);
            return new Response("Invalid pod info", { status: 400 });
        }
        console.log('pod', pod)

        let k3sStreamRequest: any | undefined;
        let logStream: stream.PassThrough | undefined;
        let streamEndedByClient = false;

        const encoder = new TextEncoder();
        const customReadable = new ReadableStream({
            start(controller) {
                const innerFunc = async () => {
                    console.log(`[CONNECT] Client joined log stream for ${streamKey}`);
                    controller.enqueue(encoder.encode('Connected\n'));

                    if (namespace !== buildNamespace) {
                        // container logs and not build logs
                        await podService.waitUntilPodIsRunningFailedOrSucceded(namespace, pod.podName); // has timeout onfigured
                    }
                    logStream = new stream.PassThrough();

                    k3sStreamRequest = await k3s.log.log(namespace, pod.podName, pod.containerName, logStream, {
                        follow: true,
                        tailLines: namespace === buildNamespace ? undefined : 100,
                        timestamps: true,
                        pretty: false,
                        previous: false
                    });

                    logStream.on('data', (chunk) => {
                        controller.enqueue(encoder.encode(chunk.toString()));
                    });

                    logStream.on('error', (error) => {
                        controller.enqueue(encoder.encode('[ERROR] An unexpected error occurred while streaming logs.\n'));
                        console.error("Error in log stream:", error);
                    });

                    logStream.on('end', () => {
                        console.log(`[END] Log stream ended for ${streamKey} by ${streamEndedByClient ? 'client' : 'server'}`);
                        if (!streamEndedByClient) {
                            controller.enqueue(encoder.encode('[INFO] Log stream closed by Pod.'));
                            controller.close();
                        }
                    });
                };
                innerFunc();
            },
            cancel() {
                streamEndedByClient = true;
                logStream?.end();
                k3sStreamRequest?.abort();
                console.log(`[DISCONNECTED] Client disconnected log stream for ${streamKey}`);
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