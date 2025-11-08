import { ServiceException } from "@/shared/model/service.exception.model";
import dataAccess from "../../adapter/db.client";
import hostnameDnsProviderService from "../traefik-me-domain.service";
import { KubeObjectNameUtils } from "../../utils/kube-object-name.utils";
import deploymentService from "../deployment.service";
import { V1Deployment, V1Ingress } from "@kubernetes/client-node";
import { Constants } from "@/shared/utils/constants";
import k3s from "../../adapter/kubernetes-api.adapter";
import ingressService from "../ingress.service";
import svcService from "../svc.service";
import podService from "../pod.service";
import appService from "../app.service";
import { AppExtendedModel } from "@/shared/model/app-extended.model";

export class BaseDbToolService {

    appIdToToolNameConverter: (appId: string) => string;

    constructor(appIdToToolNameConverter: (appId: string) => string) {
        this.appIdToToolNameConverter = appIdToToolNameConverter;
    }

    async isDbToolRunning(appId: string) {
        const toolAppName = this.appIdToToolNameConverter(appId);
        const app = await appService.getExtendedById(appId);
        const projectId = app.projectId;

        const existingDeployment = await deploymentService.getDeployment(projectId, toolAppName);
        if (!existingDeployment) {
            return false;
        }

        const existingService = await svcService.getService(projectId, toolAppName);
        if (!existingService) {
            return false;
        }

        const existingIngress = await ingressService.getIngressByName(projectId, toolAppName);
        if (!existingIngress) {
            return false;
        }

        return true;
    }

    async getLoginCredentialsForRunningTool(appId: string,
        searchFunc: (existingDeployment: V1Deployment, app: AppExtendedModel) => { username: string, password: string }) {
        const app = await appService.getExtendedById(appId);
        const toolAppName = this.appIdToToolNameConverter(appId);
        const projectId = app.projectId;

        const isDbGateRunning = await this.isDbToolRunning(appId);
        if (!isDbGateRunning) {
            throw new ServiceException('DB Gate is not running for this database');
        }

        const existingDeployment = await deploymentService.getDeployment(projectId, toolAppName);
        if (!existingDeployment) {
            throw new ServiceException('DB Gate is not running for this database');
        }

        const { username, password } = searchFunc(existingDeployment, app);
        const traefikHostname = await hostnameDnsProviderService.getDomainForApp(toolAppName);
        return { url: `https://${traefikHostname}`, username, password };
    }

    async deployToolForDatabase(appId: string, appPort: number, deplyomentBuilder: (app: AppExtendedModel) => V1Deployment | Promise<V1Deployment>) {
        const app = await appService.getExtendedById(appId);
        const toolAppName = this.appIdToToolNameConverter(appId);

        if (app.appType === 'APP') {
            throw new ServiceException(`The DB Tool ${toolAppName} can only be deployed for databases, not for apps`);
        }

        const namespace = app.projectId;

        console.log(`Deploying DB Tool ${toolAppName} for app ${appId}`);
        const hostnameDnsProviderHostname = await hostnameDnsProviderService.getDomainForApp(toolAppName);

        console.log(`Creating DB Tool ${toolAppName} deployment for app ${appId}`);
        await this.createOrUpdateDbGateDeployment(app, deplyomentBuilder);

        console.log(`Creating service for DB Tool ${toolAppName} for app ${appId}`);
        await svcService.createOrUpdateService(namespace, toolAppName, [{
            name: 'http',
            port: 80,
            targetPort: appPort,
        }]);

        console.log(`Creating ingress for DB Tool ${toolAppName} for app ${appId}`);
        await this.createOrUpdateIngress(toolAppName, namespace, hostnameDnsProviderHostname);

        const fileBrowserPods = await podService.getPodsForApp(namespace, toolAppName);
        for (const pod of fileBrowserPods) {
            await podService.waitUntilPodIsRunningFailedOrSucceded(namespace, pod.podName);
        }
    }


    private async createOrUpdateDbGateDeployment(app: AppExtendedModel, deplyomentBuilder: (app: AppExtendedModel) => V1Deployment | Promise<V1Deployment>) {
        const body = await deplyomentBuilder(app);
        const toolAppName = this.appIdToToolNameConverter(app.id);
        await deploymentService.applyDeployment(app.projectId, toolAppName, body);
    }

    async deleteToolForAppIfExists(appId: string) {
        const app = await dataAccess.client.app.findFirst({
            where: {
                id: appId
            }
        });

        if (!app) {
            return;
        }

        const toolAppName = this.appIdToToolNameConverter(appId);
        const projectId = app.projectId;

        const existingDeployment = await deploymentService.getDeployment(projectId, toolAppName);
        if (existingDeployment) { await k3s.apps.deleteNamespacedDeployment(toolAppName, projectId); }

        const existingService = await svcService.getService(projectId, toolAppName);
        if (existingService) { await svcService.deleteService(projectId, toolAppName); }

        const existingIngress = await ingressService.getIngressByName(projectId, toolAppName);
        if (existingIngress) {
            await k3s.network.deleteNamespacedIngress(KubeObjectNameUtils.getIngressName(toolAppName), projectId);
        }
    }

    private async createOrUpdateIngress(dbGateAppName: string, namespace: string, hostname: string) {
        const ingressDefinition: V1Ingress = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: KubeObjectNameUtils.getIngressName(dbGateAppName),
                namespace: namespace,
                annotations: {
                    // dont annotate, because ingress will be deleted after redeployment of app
                    // [Constants.QS_ANNOTATION_APP_ID]: appId,
                    // [Constants.QS_ANNOTATION_PROJECT_ID]: projectId,
                    ...({ 'cert-manager.io/cluster-issuer': 'letsencrypt-production' }), // --> dont start cert-manager for traefik.me domains
                }
            },
            spec: {
                ingressClassName: 'traefik',
                rules: [
                    {
                        host: hostname,
                        http: {
                            paths: [
                                {
                                    path: '/',
                                    pathType: 'Prefix',
                                    backend: {
                                        service: {
                                            name: KubeObjectNameUtils.toServiceName(dbGateAppName),
                                            port: {
                                                number: 80,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
                tls: [{
                    hosts: [hostname],
                    secretName: `secret-tls-${hostname}`.substring(0, 63)
                }],
            },
        };

        const existingIngress = await ingressService.getIngressByName(namespace, dbGateAppName);
        if (existingIngress) {
            await k3s.network.replaceNamespacedIngress(KubeObjectNameUtils.getIngressName(dbGateAppName), namespace, ingressDefinition);
        } else {
            await k3s.network.createNamespacedIngress(namespace, ingressDefinition);
        }
    }
}
