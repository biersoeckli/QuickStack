import k3s from "@/server/adapter/kubernetes-api.adapter";
import appService from "@/server/services/app.service";
import deploymentService from "@/server/services/deployment.service";
import { isAuthorizedReadForApp, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { Informer, V1Pod } from "@kubernetes/client-node";
import { z } from "zod";
import * as k8s from '@kubernetes/client-node';

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const zodInputModel = z.object({
    appId: z.string(),
});

export async function POST(request: Request) {
    return simpleRoute(async () => {
        const input = await request.json();
        const podInfo = zodInputModel.parse(input);
        let { appId } = podInfo;
        await isAuthorizedReadForApp(appId);

        const app = await appService.getById(appId);
        const namespace = app.projectId;
        // Source:
        // https://github.com/kubernetes-client/javascript/blob/master/examples/typescript/informer/informer-with-label-selector.ts
        // https://github.com/kubernetes-client/javascript/blob/master/examples/typescript/watch/watch-example.ts

        let informer: Informer<V1Pod>;
        const encoder = new TextEncoder();
        let shouldStopStreaming = false;

        const customReadable = new ReadableStream({
            start(controller) {

                const getDeploymentStatus = async () => {
                    const deploymentStatus = await deploymentService.getDeploymentStatus(app.projectId, app.id);
                    try {
                        controller.enqueue(encoder.encode(deploymentStatus))
                    } catch (e) {
                        console.error(`[ENQUEUE ERROR] Error while enqueueing Deployment Status for app ${appId}: `, e);
                        shouldStopStreaming = true;
                        informer?.stop();
                        controller.close();
                    }
                };

                const kc = k3s.getKubeConfig();
                informer = k8s.makeInformer(
                    kc,
                    `/api/v1/namespaces/${namespace}/pods`,
                    () => k3s.core.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `app=${app.id}`),
                    `app=${app.id}`
                );

                informer.on('add', () => getDeploymentStatus());
                informer.on('update', () => getDeploymentStatus());
                //informer.on('change', () => getDeploymentStatus());
                informer.on('delete', () => getDeploymentStatus());
                informer.on('error', (err: any) => {
                    // todo there is a error because of the invalid Certificat Authority, so every time error
                    // is thrown, we need to restart the informer --> TODO
                    console.error(`[INFORMER ERROR] Error while listening for Deplyoment Changes for app ${appId}: `, err);
                    // todo fix this^^
                    getDeploymentStatus()
                    // Try to restart informer after 5sec
                    //if (!shouldStopStreaming) setTimeout(() => informer.start(), 5000);
                });

                informer.start();
                getDeploymentStatus();
                console.log("[START] Starting informer for app " + appId);
            },
            cancel() {
                console.log("[LEAVE] Cancelling informer for app " + appId);
                informer?.stop();
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