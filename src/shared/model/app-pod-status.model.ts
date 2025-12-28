import { DeploymentStatus } from "./deployment-info.model";

export interface AppPodsStatusModel {
    appId: string;
    appName: string;
    projectId: string;
    projectName: string;
    replicas?: number;
    readyReplicas?: number;
    deploymentStatus: DeploymentStatus;
}
