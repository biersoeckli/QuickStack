import buildLiveStatusService from "@/server/services/build-live-status.service";
import buildStatusService from "@/server/services/standalone-services/build-status.service";
import buildWatchService from "@/server/services/standalone-services/build-watch.service";
import { getAuthUserSession, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { StreamUtils } from "@/shared/utils/stream.utils";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

export async function POST() {
    return simpleRoute(async () => {
        const session = await getAuthUserSession();

        void buildWatchService.startWatch();
        await buildStatusService.ensureSeeded();

        let appLookup = await buildLiveStatusService.getBuildableAppLookup(session);

        const encoder = new TextEncoder();
        let shouldStopStreaming = false;
        let unsubscribe: (() => void) | null = null;

        const customReadable = new ReadableStream({
            async start(controller) {
                const sendData = (data: unknown) => {
                    if (shouldStopStreaming) {
                        return;
                    }
                    try {
                        controller.enqueue(encoder.encode(StreamUtils.encodeSseData(data)));
                    } catch (e) {
                        console.error(`[BUILD STATUS] Error while enqueueing build status data: `, e);
                        shouldStopStreaming = true;
                        controller.close();
                    }
                };

                unsubscribe = buildStatusService.subscribe(async (status) => {
                    if (shouldStopStreaming || status.workloadType !== 'app') {
                        return;
                    }

                    let appInfo = appLookup.get(status.workloadId);
                    if (!appInfo) {
                        // A new app might have been created while streaming, refresh the lookup.
                        appLookup = await buildLiveStatusService.getBuildableAppLookup(session);
                        appInfo = appLookup.get(status.workloadId);
                    }
                    if (!appInfo) {
                        return;
                    }

                    sendData(buildLiveStatusService.mapBuildToStatus(status, appInfo));
                });

                try {
                    sendData(buildLiveStatusService.getInitialStatus(appLookup));
                } catch (e) {
                    console.error("Error fetching initial build status", e);
                }
            },
            cancel() {
                console.log("[BUILD STATUS] Client left, cancelling build status stream");
                shouldStopStreaming = true;
                if (unsubscribe) {
                    unsubscribe();
                    unsubscribe = null;
                }
            },
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
