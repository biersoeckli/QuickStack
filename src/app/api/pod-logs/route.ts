import { z } from "zod";
import stream from "stream";
import k3s from "@/server/adapter/kubernetes-api.adapter";
import { ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "@/shared/utils/constants";
import podService from "@/server/services/pod.service";
import { StreamUtils } from "@/shared/utils/stream.utils";
import { getUserSession, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { ensureReadProjectWorkload, RequesterIdentity } from "@/server/utils/shared-authorization.utils";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const zodInputModel = z.object({
    namespace: z.string().optional(),
    podName: z.string().optional(),
    linesCount: z.number().optional().default(100),
});

export async function POST(request: Request) {
    return simpleRoute(async () => {
        const session = await getUserSession();
        if (!session) {
            throw new ServiceException('User is not authenticated.');
        }

        const identity: RequesterIdentity = { type: 'session', session };
        const input = await request.json();

        const podInfo = zodInputModel.parse(input);
        const { namespace, podName, linesCount } = podInfo;
        if (!namespace || !podName) {
            console.error('Invalid pod info for streaming logs', podInfo);
            return new Response("Invalid pod info", { status: 400 });
        }

        let pod;
        try {
            pod = await podService.getPodByName(namespace, podName);
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                throw new ServiceException('Pod not found.');
            }
            throw error;
        }

        const labels = pod.metadata?.labels ?? {};
        const annotations = pod.metadata?.annotations ?? {};
        const workloadCandidates = new Set<string>();
        for (const value of [
            labels[Constants.QS_ANNOTATION_APP_ID],
            annotations[Constants.QS_ANNOTATION_APP_ID],
            labels[Constants.QS_ANNOTATION_AGENT_ID],
            annotations[Constants.QS_ANNOTATION_AGENT_ID],
        ]) {
            if (value) {
                workloadCandidates.add(value);
            }
        }

        let authorized = false;
        for (const workloadId of workloadCandidates) {
            try {
                ensureReadProjectWorkload(identity, workloadId);
                authorized = true;
                break;
            } catch {
            }
        }
        if (!authorized) {
            console.error(`User ${session.email} is not authorized to stream logs of pod ${namespace}/${podName}.`);
            throw new ServiceException('User is not authorized for this action.');
        }

        const actualPodName = pod.metadata?.name;
        const containerName = pod.spec?.containers?.[0]?.name;
        if (!actualPodName || !containerName) {
            throw new ServiceException('Pod does not expose any streamable container.');
        }

        const streamKey = `${namespace}_${actualPodName}`;

        let k3sStreamRequest: any | undefined;
        let logStream: stream.PassThrough | undefined;
        let streamEndedByClient = false;

        const encoder = new TextEncoder();
        const customReadable = new ReadableStream({
            start(controller) {
                const innerFunc = async () => {
                    console.log(`[CONNECT] Client joined log stream for ${streamKey}`);
                    controller.enqueue(encoder.encode(StreamUtils.encodeSseData('Stream opened, loading pod logs...\n')));

                    await podService.waitUntilPodIsRunningFailedOrSucceded(namespace, actualPodName); // has timeout configured

                    logStream = new stream.PassThrough();

                    k3sStreamRequest = await k3s.log.log(namespace, actualPodName, containerName, logStream, {
                        follow: true,
                        tailLines: linesCount,
                        timestamps: true,
                        pretty: false,
                        previous: false
                    });

                    logStream.on('data', (chunk) => {
                        controller.enqueue(encoder.encode(StreamUtils.encodeSseData(chunk.toString())));
                    });

                    logStream.on('error', (error) => {
                        controller.enqueue(encoder.encode(StreamUtils.encodeSseData('[ERROR] An unexpected error occurred while streaming logs.\n')));
                        console.error("Error in log stream:", error);
                    });

                    logStream.on('end', () => {
                        console.log(`[END] Log stream ended for ${streamKey} by ${streamEndedByClient ? 'client' : 'server'}`);
                        if (!streamEndedByClient) {
                            controller.enqueue(encoder.encode(StreamUtils.encodeSseData('[INFO] Log stream closed by Pod.')));
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
