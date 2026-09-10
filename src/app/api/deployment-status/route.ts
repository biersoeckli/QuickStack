import deploymentLiveStatusService from "@/server/services/deployment-live-status.service";
import buildPodLogWatchService from "@/server/services/standalone-services/build-pod-log-watch.service";
import buildWatchService from "@/server/services/standalone-services/build-watch.service";
import deploymentEventWatchService from "@/server/services/standalone-services/deployment-event-watch.service";
import deploymentWatchService from "@/server/services/standalone-services/deployment-watch.service";
import { getAuthUserSession, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { V1Deployment } from "@kubernetes/client-node";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const IGNORED_NAMESPACES = ['default', 'longhorn-system', 'kube-public', 'kube-system', 'cert-manager'];

export async function POST() {
    return simpleRoute(async () => {

        const session = await getAuthUserSession();

        buildPodLogWatchService.startWatch();
        buildWatchService.startWatch();
        deploymentEventWatchService.startWatch();

        const encoder = new TextEncoder();
        let shouldStopStreaming = false;
        let unsubscribe: (() => void) | null = null;

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

                // 2. Subscribe to the shared watch for changes
                unsubscribe = deploymentWatchService.subscribe(async (type, deployment: V1Deployment) => {
                    if (shouldStopStreaming) { return; }

                    const appId = deployment.metadata?.name;
                    const projectId = deployment.metadata?.namespace;

                    if (!appId || !projectId) { return; }

                    // ignore system namespaces
                    if (IGNORED_NAMESPACES.includes(projectId)) { return; }

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
                });
            },
            cancel() {
                console.log("[LEAVE] Cancelling deployment status stream");
                shouldStopStreaming = true;
                if (unsubscribe) {
                    unsubscribe();
                    unsubscribe = null;
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
