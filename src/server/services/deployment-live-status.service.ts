import projectService from "@/server/services/project.service";
import deploymentService from "@/server/services/deployment.service";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import { UserSession } from "@/shared/model/sim-session.model";
import { V1Deployment } from "@kubernetes/client-node";
import { AppPodsStatusModel } from "@/shared/model/app-pod-status.model";

export interface AppLookupInfo {
    appName: string;
    projectId: string;
    projectName: string;
}

class DeploymentLiveStatusService {

    async getAppLookup(session?: UserSession): Promise<Map<string, AppLookupInfo>> {
        const projects = await projectService.getAllProjects();
        const appLookup = new Map<string, AppLookupInfo>();

        for (const project of projects) {
            for (const app of project.apps) {
                if (session) {
                    if (!UserGroupUtils.sessionHasReadAccessForApp(session, app.id)) {
                        continue;
                    }
                }
                appLookup.set(app.id, {
                    appName: app.name,
                    projectId: project.id,
                    projectName: project.name
                });
            }
        }
        return appLookup;
    }

    async getInitialStatus(appLookup: Map<string, AppLookupInfo>): Promise<AppPodsStatusModel[]> {
        const allDeployments = await deploymentService.getAllDeployments();
        const initialStatus: AppPodsStatusModel[] = [];

        // Iterate over all known apps to ensure we send status for everything (even SHUTDOWN)
        for (const [appId, info] of Array.from(appLookup.entries())) {
            const deployment = allDeployments.find(d => d.metadata?.name === appId && d.metadata?.namespace === info.projectId);
            initialStatus.push(this.mapDeploymentToStatus(appId, info, deployment));
        }
        return initialStatus;
    }

    mapDeploymentToStatus(appId: string, appInfo: AppLookupInfo, deployment?: V1Deployment): AppPodsStatusModel {
        if (deployment) {
            return {
                appId: appId,
                appName: appInfo.appName,
                projectId: appInfo.projectId,
                projectName: appInfo.projectName,
                replicas: deployment.status?.replicas,
                readyReplicas: deployment.status?.readyReplicas,
                deploymentStatus: deploymentService.mapReplicasetToStatus(deployment)
            };
        } else {
            return {
                appId: appId,
                appName: appInfo.appName,
                projectId: appInfo.projectId,
                projectName: appInfo.projectName,
                replicas: undefined,
                readyReplicas: undefined,
                deploymentStatus: 'SHUTDOWN'
            };
        }
    }
}

const deploymentLiveStatusService = new DeploymentLiveStatusService();
export default deploymentLiveStatusService;
