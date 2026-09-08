import { z } from "zod";
import { ServiceException } from "@/shared/model/service.exception.model";
import { zodWorkloadType, WorkloadType } from "@/shared/model/runtime-type.model";
import deploymentLogService from "@/server/services/deployment-logs.service";
import deploymentService from "@/server/services/deployment.service";
import buildService from "@/server/services/build.service";
import appService from "@/server/services/app.service";
import { getUserSession, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { ensureReadProjectWorkload, RequesterIdentity } from "@/server/utils/shared-authorization.utils";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const zodInputModel = z.object({
    deploymentId: z.string().min(1),
    workloadId: z.string().min(1),
    workloadType: zodWorkloadType,
});

export async function POST(request: Request) {
    return simpleRoute(async () => {
        const session = await getUserSession();
        if (!session) {
            throw new ServiceException('User is not authenticated.');
        }

        const identity: RequesterIdentity = { type: 'session', session };
        const input = await request.json();

        const inputInfo = zodInputModel.parse(input);
        const { deploymentId, workloadId, workloadType } = inputInfo;

        ensureReadProjectWorkload(identity, workloadId);

        if (!await isDeploymentOfWorkload(workloadId, workloadType, deploymentId)) {
            console.error(`User ${session.email} is not authorized to stream build logs of deployment ${deploymentId} for workload ${workloadId}.`);
            throw new ServiceException('User is not authorized for this action.');
        }

        let closeListenerFunc: (() => void) | undefined;

        const encoder = new TextEncoder();
        const customReadable = new ReadableStream({
            start(controller) {
                const innerFunc = async () => {
                    console.log(`[CONNECT] Client joined build log stream for deployment ${deploymentId}`);
                    controller.enqueue(encoder.encode('Stream opened, loading build logs...\n'));

                    closeListenerFunc = await deploymentLogService.getLogsStream(deploymentId, (chunk) => {
                        controller.enqueue(encoder.encode(chunk));
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

async function isDeploymentOfWorkload(workloadId: string, workloadType: WorkloadType, deploymentId: string): Promise<boolean> {
    if (workloadType === 'app') {
        const app = await appService.getByIdOrUndefined(workloadId);
        if (!app) {
            return false;
        }
        const deploymentHistory = await deploymentService.getDeploymentHistory(app.projectId, workloadId);
        if (deploymentHistory.some((deployment) => deployment.deploymentId === deploymentId)) {
            return true;
        }
        const builds = await buildService.getBuildsForApp(workloadId);
        return builds.some((build) => build.deploymentId === deploymentId);
    }

    const builds = await buildService.getBuildsForAgent(workloadId);
    return builds.some((build) => build.deploymentId === deploymentId);
}
