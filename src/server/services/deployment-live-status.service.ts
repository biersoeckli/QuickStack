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
        const projects = await projectService.getAll();
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
        const deploymentLookup = new Map<string, V1Deployment>();

        for (const deployment of allDeployments) {
            const name = deployment.metadata?.name;
            const namespace = deployment.metadata?.namespace;
            if (!name || !namespace) { continue; }
            deploymentLookup.set(this.deploymentKey(namespace, name), deployment);
        }

        const initialStatus: AppPodsStatusModel[] = [];

        // Iterate over all known apps to ensure we send status for everything (even SHUTDOWN)
        for (const [appId, info] of appLookup.entries()) {
            const deployment = deploymentLookup.get(this.deploymentKey(info.projectId, appId));
            initialStatus.push(this.mapDeploymentToStatus(appId, info, deployment));
        }
        return initialStatus;
    }

    private deploymentKey(namespace: string, name: string): string {
        return `${namespace}/${name}`;
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
