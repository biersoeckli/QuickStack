'use server'

import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import projectService from "@/server/services/project.service";
import { getAuthUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import deploymentService from "@/server/services/deployment.service";
import { DeplyomentStatus } from "@/shared/model/deployment-info.model";

export interface AppPodsStatusModel {
    appId: string;
    appName: string;
    projectId: string;
    projectName: string;
    replicas?: number;
    readyReplicas?: number;
    deploymentStatus: DeplyomentStatus;
}

export const getAllPodsStatus = async () =>
    simpleAction(async () => {
        await getAuthUserSession();

        const allAppPods: AppPodsStatusModel[] = [];
        const [projects, allDeployments] = await Promise.all([
            projectService.getAllProjects(),
            deploymentService.getAllDeployments()
        ]);

        for (const project of projects) {
            for (const app of project.apps) {
                const deploymentInfo = allDeployments.find(dep =>
                    dep.metadata?.namespace === project.id &&
                    dep.metadata?.name === app.id
                );
                if (!deploymentInfo) {
                    allAppPods.push({
                        appId: app.id,
                        appName: app.name,
                        projectId: project.id,
                        projectName: project.name,
                        replicas: undefined,
                        readyReplicas: undefined,
                        deploymentStatus: 'SHUTDOWN' // nothing is deployed, so maybe the app is just created in the database and not started yet
                    });
                    continue;
                }
                const deploymentStatus = deploymentService.mapReplicasetToStatus(deploymentInfo);
                allAppPods.push({
                    appId: app.id,
                    appName: app.name,
                    projectId: project.id,
                    projectName: project.name,
                    replicas: deploymentInfo.status?.replicas,
                    readyReplicas: deploymentInfo.status?.readyReplicas,
                    deploymentStatus
                });
            }
        }

        return allAppPods;
    }) as Promise<ServerActionResult<unknown, AppPodsStatusModel[]>>;
