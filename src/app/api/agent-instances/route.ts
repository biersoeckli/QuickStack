import k3s from "@/server/adapter/kubernetes-api.adapter";
import agentRuntimeService from "@/server/services/agent-runtime.service";
import agentService from "@/server/services/agent.service";
import { isAuthorizedReadForAgent, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { Constants } from "@/shared/utils/constants";
import * as k8s from '@kubernetes/client-node';
import z from "zod";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    return simpleRoute(async () => {

        const inputParam = z.object({
            agentId: z.string(),
        }).parse(await request.json());

        await isAuthorizedReadForAgent(inputParam.agentId);
        const agent = await agentService.getById(inputParam.agentId);
        const namespace = agent.project.id;

        const encoder = new TextEncoder();
        let shouldStopStreaming = false;
        let watchRequest: { abort: () => void } | null = null;

        let agentInstances = await agentRuntimeService.listInstances(agent.id);

        const customReadable = new ReadableStream({
            async start(controller) {

                const send = (data: any) => {
                    if (shouldStopStreaming) return;
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch (e) {
                        console.error(`[ENQUEUE ERROR] Error while enqueueing Agent Claim Status data: `, e);
                        shouldStopStreaming = true;
                        controller.close();
                    }
                };

                // 1. Send full initial snapshot
                send({ type: 'FULL', data: agentInstances });


                // 2. Watch for changes — only for labeled claims of this agent
                const kc = k3s.getKubeConfig();
                const watch = new k8s.Watch(kc);
                console.log("[START] Starting watch for agent instances in namespace", namespace);
                watchRequest = await watch.watch(
                    `/apis/extensions.agents.x-k8s.io/v1alpha1/namespaces/${namespace}/sandboxclaims`,
                    { labelSelector: `${Constants.QS_ANNOTATION_AGENT_INSTANCE_LABEL}=${inputParam.agentId}` },
                    async (type, apiObj) => {
                        if (shouldStopStreaming) return;

                        // DELETED: only need the name — apiObj is the deleted object
                        if (type === 'DELETED') {
                            const name = apiObj?.metadata?.name;
                            if (name) {
                                send({ type: 'DELETED', instance: { name } });
                            }
                            return;
                        }

                        // ADDED / MODIFIED: map full claim to instance DTO
                        const instance = agentRuntimeService.mapClaimToInstance(apiObj, namespace);
                        send({ type, instance });
                    },
                    (err) => {
                        if (err) console.error('agent instances watch error', err);
                        console.log('agent instances watch ended');
                        if (!shouldStopStreaming) {
                            controller.close();
                        }
                    }
                );
            },
            cancel() {
                console.log("[LEAVE] Cancelling informer for agent instances");
                shouldStopStreaming = true;
                if (watchRequest && typeof watchRequest.abort === 'function') {
                    watchRequest.abort();
                }
            }
        });

        return new Response(customReadable, {
            headers: {
                Connection: "keep-alive",
                "Content-Encoding": "none",
                "Cache-Control": "no-cache, no-transform",
                "Content-Type": "text/event-stream; charset=utf-8",
            },
        });
    });
}
