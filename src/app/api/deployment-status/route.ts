import k3s from "@/server/adapter/kubernetes-api.adapter";
import deploymentLiveStatusService from "@/server/services/deployment-live-status.service";
import { getAuthUserSession, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { V1Deployment } from "@kubernetes/client-node";
import * as k8s from '@kubernetes/client-node';

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    return simpleRoute(async () => {

        const session = await getAuthUserSession();

        const encoder = new TextEncoder();
        let shouldStopStreaming = false;
        let watchRequest: { abort: () => void } | null = null;

        // Fetch all projects and apps to build a lookup map
        let appLookup = await deploymentLiveStatusService.getAppLookup(session);

        const customReadable = new ReadableStream({
            async start(controller) {

                const sendData = (data: any) => {
                    if (shouldStopStreaming) return;
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch (e) {
                        console.error(`[ENQUEUE ERROR] Error while enqueueing Deployment Status data: `, e);
                        shouldStopStreaming = true;
                        controller.close();
                    }
                };

                // 1. Send initial state
                try {
                    const initialStatus = await deploymentLiveStatusService.getInitialStatus(appLookup);
                    sendData(initialStatus);
                } catch (e) {
                    console.error("Error fetching initial status", e);
                }

                // 2. Watch for changes
                const kc = k3s.getKubeConfig();
                const watch = new k8s.Watch(kc);
                console.log("[START] Starting watch for deployments ");
                watchRequest = await watch.watch(
                    '/apis/apps/v1/deployments',
                    {},
                    async (type, apiObj, watchObj) => {
                        if (shouldStopStreaming) { return; }

                        const deployment = apiObj as V1Deployment;
                        const appId = deployment.metadata?.name;
                        const projectId = deployment.metadata?.namespace;

                        if (!appId || !projectId) { return; }

                        // ignore system namespaces
                        if (['default', 'longhorn-system', 'kube-public', 'kube-system', 'cert-manager'].includes(projectId)) { return; }

                        // If a new deployment is detected (ADDED) and we don't know about it,
                        // it might be a newly created app. Refresh the lookup.
                        if (type === 'ADDED' && !appLookup.has(appId)) {
                            console.log(`[LiveStatus] New unknown deployment detected for ${appId}, refreshing app lookup`);
                            appLookup = await deploymentLiveStatusService.getAppLookup(session);
                        }

                        const appInfo = appLookup.get(appId);
                        if (!appInfo) {
                            return;
                        }

                        // Verify namespace matches project ID
                        if (appInfo.projectId !== projectId) { return; }

                        let status;
                        if (type === 'DELETED') {
                            status = deploymentLiveStatusService.mapDeploymentToStatus(appId, appInfo, undefined);
                        } else {
                            status = deploymentLiveStatusService.mapDeploymentToStatus(appId, appInfo, deployment);
                        }

                        sendData(status);
                    },
                    (err) => {
                        if (err) console.error('Deploy watch error', err);
                        console.log('Deploy watch ended');
                        if (!shouldStopStreaming) {
                            controller.close();
                        }
                    }
                );
            },
            cancel() {
                console.log("[LEAVE] Cancelling informer for deployments");
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