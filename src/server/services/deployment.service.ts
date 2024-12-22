import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Deployment, V1ReplicaSet } from "@kubernetes/client-node";
import buildService from "./build.service";
import { ListUtils } from "../../shared/utils/list.utils";
import { DeploymentInfoModel, DeplyomentStatus } from "@/shared/model/deployment-info.model";
import { BuildJobStatus } from "@/shared/model/build-job";
import { ServiceException } from "@/shared/model/service.exception.model";
import pvcService from "./pvc.service";
import ingressService from "./ingress.service";
import namespaceService from "./namespace.service";
import { Constants } from "../../shared/utils/constants";
import svcService from "./svc.service";
import { dlog } from "./deployment-logs.service";
import registryService from "./registry.service";
import { EnvVarUtils } from "../utils/env-var.utils";

class DeploymentService {

    async getDeployment(projectId: string, appId: string) {
        const allDeployments = await k3s.apps.listNamespacedDeployment(projectId);
        if (allDeployments.body?.items?.some((item) => item.metadata?.name === appId)) {
            const res = await k3s.apps.readNamespacedDeployment(appId, projectId);
            return res.body;
        }
    }

    async deleteDeployment(projectId: string, appId: string) {
        const existingDeployment = await this.getDeployment(projectId, appId);
        if (!existingDeployment) {
            return;
        }
        const returnVal = await k3s.apps.deleteNamespacedDeployment(appId, projectId);
        console.log(`Deleted Deployment ${appId} in namespace ${projectId}`);
        return returnVal;
    }

    async validateDeployment(app: AppExtendedModel) {
        if (app.replicas > 1 && app.appVolumes.length > 0 && app.appVolumes.every(vol => vol.accessMode === 'ReadWriteOnce')) {
            throw new ServiceException("Deployment with more than one replica is not possible if access mode of one volume is ReadWriteOnce.");
        }
    }

    async createDeployment(deploymentId: string, app: AppExtendedModel, buildJobName?: string, gitCommitHash?: string) {
        await this.validateDeployment(app);

        dlog(deploymentId, `Starting deployment of containter...`);

        await namespaceService.createNamespaceIfNotExists(app.projectId);
        const appHasPvcChanges = await pvcService.doesAppConfigurationIncreaseAnyPvcSize(app);
        if (appHasPvcChanges) {
            dlog(deploymentId, `Configuring Storage Volumes...`);
            await this.setReplicasForDeployment(app.projectId, app.id, 0); // update of PVCs is only possible if deployment is scaled down
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        const { volumes, volumeMounts } = await pvcService.createOrUpdatePvc(app);
        if (volumes && volumes.length > 0) {
            dlog(deploymentId, `Configured ${volumes.length} Storage Volumes.`);
        }

        const envVars = EnvVarUtils.parseEnvVariables(app);
        dlog(deploymentId, `Configured ${envVars.length} Env Variables.`);

        const existingDeployment = await this.getDeployment(app.projectId, app.id);
        const body: V1Deployment = {
            metadata: {
                name: app.id,
            },
            spec: {
                replicas: app.replicas,
                selector: {
                    matchLabels: {
                        app: app.id
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            app: app.id
                        },
                        annotations: {
                            [Constants.QS_ANNOTATION_APP_ID]: app.id,
                            [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
                            [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: deploymentId,
                            deploymentTimestamp: new Date().getTime() + "",
                            "kubernetes.io/change-cause": `Deployment ${new Date().toISOString()}`
                        }
                    },
                    spec: {
                        containers: [
                            {
                                name: app.id,
                                image: !!buildJobName ? registryService.createContainerRegistryUrlForAppId(app.id) : app.containerImageSource as string,
                                imagePullPolicy: 'Always',
                                ...(envVars.length > 0 ? { env: envVars } : {}),
                                ...(volumeMounts.length > 0 ? { volumeMounts: volumeMounts } : {}),
                            }
                        ],
                        ...(volumes.length > 0 ? { volumes: volumes } : {}),
                    }
                }
            }
        };
        if (buildJobName) {
            body.spec!.template!.metadata!.annotations!.buildJobName = buildJobName; // add buildJobName to deployment
        }

        if (gitCommitHash) {
            body.spec!.template!.metadata!.annotations![Constants.QS_ANNOTATION_GIT_COMMIT] = gitCommitHash; // add gitCommitHash to deployment
        }

        if (!appHasPvcChanges && app.appVolumes.length === 0 || app.appVolumes.every(vol => vol.accessMode === 'ReadWriteMany')) {
            body.spec!.strategy = {
                type: 'RollingUpdate',
                rollingUpdate: {
                    maxSurge: 1,
                    maxUnavailable: 0
                }
            }
        } else {
            body.spec!.strategy = {
                type: 'Recreate',
            }
        }

        if (app.cpuLimit || app.memoryLimit) {
            body.spec!.template!.spec!.containers[0].resources = {
                limits: {}
            }
            if (app.cpuLimit) {
                body.spec!.template!.spec!.containers[0].resources!.limits!.cpu! = `${app.cpuLimit}m`;
            }
            if (app.memoryLimit) {
                body.spec!.template!.spec!.containers[0].resources!.limits!.memory! = `${app.memoryLimit}M`;
            }
        }

        if (app.cpuReservation || app.memoryReservation) {
            body.spec!.template!.spec!.containers[0].resources = {
                requests: {}
            }
            if (app.cpuReservation) {
                body.spec!.template!.spec!.containers[0].resources!.requests!.cpu! = `${app.cpuReservation}m`;
            }
            if (app.memoryReservation) {
                body.spec!.template!.spec!.containers[0].resources!.requests!.memory! = `${app.memoryReservation}M`;
            }
        }

        if (existingDeployment) {
            dlog(deploymentId, `Replacing existing deployment...`);
            const res = await k3s.apps.replaceNamespacedDeployment(app.id, app.projectId, body);
        } else {
            dlog(deploymentId, `Creating deployment...`);
            const res = await k3s.apps.createNamespacedDeployment(app.projectId, body);
        }
        await pvcService.deleteUnusedPvcOfApp(app);
        await svcService.createOrUpdateService(deploymentId, app);
        dlog(deploymentId, `Updating ingress...`);
        await ingressService.createOrUpdateIngressForApp(deploymentId, app);
        dlog(deploymentId, `Deployment applied`);
    }

    async setReplicasForDeployment(projectId: string, appId: string, replicas: number) {
        const existingDeployment = await this.getDeployment(projectId, appId);
        if (!existingDeployment) {
            throw new ServiceException("This app has not been deployed yet. Please deploy it first.");
        }
        existingDeployment.spec!.replicas = replicas;
        return k3s.apps.replaceNamespacedDeployment(appId, projectId, existingDeployment);
    }


    async getDeploymentStatus(projectId: string, appId: string) {
        const deployment = await this.getDeployment(projectId, appId);
        if (!deployment) {
            return 'UNKNOWN';
        }
        return this.mapReplicasetToStatus(deployment);
    }

    /**
     * Searches for Build Jobs (only for Git Projects) and ReplicaSets (for all projects) and returns a list of DeploymentModel
     * Build are only included if they are in status RUNNING, FAILED or UNKNOWN. SUCCESSFUL builds are not included because they are already part of the ReplicaSet history.
     * @param projectId
     * @param appId
     * @returns
     */
    async getDeploymentHistory(projectId: string, appId: string): Promise<DeploymentInfoModel[]> {
        const replicasetRevisions = await this.getReplicasetRevisionHistory(projectId, appId);
        const builds = await buildService.getBuildsForApp(appId);
        // adding running or failed builds as "Deployment" to the list
        const runningOrFailedBuilds = builds
            .filter((build) => ['RUNNING', 'FAILED', 'UNKNOWN'].includes(build.status))
            .map((build) => {
                return {
                    replicasetName: undefined,
                    createdAt: build.startTime!,
                    buildJobName: build.name!,
                    status: this.mapBuildStatusToDeploymentStatus(build.status),
                    gitCommit: build.gitCommit,
                    deploymentId: build.deploymentId
                }
            });
        replicasetRevisions.push(...runningOrFailedBuilds);
        return ListUtils.sortByDate(replicasetRevisions, (i) => i.createdAt!, true);
    }

    mapBuildStatusToDeploymentStatus(buildJobStatus?: BuildJobStatus) {
        const map = new Map<BuildJobStatus, DeplyomentStatus>([
            ['UNKNOWN', 'UNKNOWN'],
            ['RUNNING', 'BUILDING'],
            ['FAILED', 'ERROR']
        ]);
        return map.get(buildJobStatus ?? 'UNKNOWN') ?? 'UNKNOWN';
    }


    async getReplicasetRevisionHistory(projectId: string, appId: string): Promise<DeploymentInfoModel[]> {

        const deployment = await this.getDeployment(projectId, appId);
        if (!deployment) {
            return [];
        }

        // List ReplicaSets in the namespace to find those associated with the deployment
        const replicaSetsForDeployment = await k3s.apps.listNamespacedReplicaSet(projectId, undefined, undefined, undefined, undefined, `app=${appId}`);

        const revisions = replicaSetsForDeployment.body.items.map((rs, index) => {
            let status = this.mapReplicasetToStatus(rs);
            return {
                replicasetName: rs.metadata?.name!,
                createdAt: rs.metadata?.creationTimestamp!,
                buildJobName: rs.spec?.template?.metadata?.annotations?.buildJobName!,
                gitCommit: rs.spec?.template?.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT],
                status: status,
                deploymentId: rs.spec?.template?.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID]!
            }
        });
        return ListUtils.sortByDate(revisions, (i) => i.createdAt!, true);
    }

    private mapReplicasetToStatus(deployment: V1Deployment | V1ReplicaSet): DeplyomentStatus {
        /*
        Fields for Status:
            availableReplicas: 1,
            conditions: undefined,
            fullyLabeledReplicas: 1,
            observedGeneration: 3,
            readyReplicas: 1,
            replicas: 1
        */
        let status: DeplyomentStatus = 'UNKNOWN';
        if (deployment.status?.replicas === undefined) {
            return 'SHUTDOWN';
        }
        if (deployment.status?.replicas === 0) {
            status = 'SHUTDOWN';
        } else if (deployment.status?.replicas === deployment.status?.readyReplicas) {
            status = 'DEPLOYED';
        } else if (deployment.status?.replicas === 0 && deployment.status?.replicas !== deployment.status?.readyReplicas) {
            status = 'SHUTTING_DOWN';
        } else if (deployment.status?.replicas !== deployment.status?.readyReplicas) {
            status = 'DEPLOYING';
        }
        return status;
    }

}

const deploymentService = new DeploymentService();
export default deploymentService;
