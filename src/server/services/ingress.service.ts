import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Ingress } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { App, AppDomain } from "@prisma/client";
import { Constants } from "../../shared/utils/constants";
import ingressSetupService from "./setup-services/ingress-setup.service";
import { dlog } from "./deployment-logs.service";


const traefikNamespace = 'kube-system';

class IngressService {

    async getAllIngressForApp(projectId: string, appId: string) {
        const res = await k3s.network.listNamespacedIngress(projectId);
        return res.body.items.filter((item) => item.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID] === appId);
    }

    async getIngress(projectId: string, domainId: string) {
        const res = await k3s.network.listNamespacedIngress(projectId);
        return res.body.items.find((item) => item.metadata?.name === KubeObjectNameUtils.getIngressName(domainId));
    }

    async deleteUnusedIngressesOfApp(app: AppExtendedModel) {
        const currentDomains = new Set(app.appDomains.map(domainObj => domainObj.hostname));
        const existingIngresses = await this.getAllIngressForApp(app.projectId, app.id);

        if (currentDomains.size === 0) {
            for (const ingress of existingIngresses) {
                await k3s.network.deleteNamespacedIngress(ingress.metadata!.name!, app.projectId);
                console.log(`Deleted Ingress ${ingress.metadata!.name} for app ${app.id}`);
            }
        } else {
            for (const ingress of existingIngresses) {
                const ingressDomain = ingress.spec?.rules?.[0]?.host;

                if (ingressDomain && !currentDomains.has(ingressDomain)) {
                    await k3s.network.deleteNamespacedIngress(ingress.metadata!.name!, app.projectId);
                    console.log(`Deleted Ingress ${ingress.metadata!.name} for domain ${ingressDomain}`);
                }
            }
        }
    }

    async deleteAllIngressForApp(projectId: string, appId: string) {
        const existingIngresses = await this.getAllIngressForApp(projectId, appId);
        for (const ingress of existingIngresses) {
            await k3s.network.deleteNamespacedIngress(ingress.metadata!.name!, projectId);
            console.log(`Deleted Ingress ${ingress.metadata!.name} for app ${appId}`);
        }
    }


    async createOrUpdateIngressForApp(deploymentId: string, app: AppExtendedModel) {

        await ingressSetupService.createTraefikRedirectMiddlewareIfNotExist();

        for (const domainObj of app.appDomains) {
            await this.createOrUpdateIngress(deploymentId, app, domainObj);
        }

        await this.deleteUnusedIngressesOfApp(app);
    }

    async createOrUpdateIngress(deploymentId: string, app: AppExtendedModel, domain: AppDomain) {
        const hostname = domain.hostname;
        const ingressName = KubeObjectNameUtils.getIngressName(domain.id);
        const existingIngress = await this.getIngress(app.projectId, domain.id);

        const ingressDefinition: V1Ingress = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: ingressName,
                namespace: app.projectId,
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: app.id,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
                    ...(domain.useSsl === true && { 'cert-manager.io/cluster-issuer': 'letsencrypt-production' }),
                    ...(domain.useSsl && domain.redirectHttps && { 'traefik.ingress.kubernetes.io/router.middlewares': 'kube-system-redirect-to-https@kubernetescrd' }), // activate redirect middleware for https
                    ...(domain.useSsl === false && { 'traefik.ingress.kubernetes.io/router.entrypoints': 'web' }), // disable requests from https --> only http
                },
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
                                            name: KubeObjectNameUtils.toServiceName(app.id),
                                            port: {
                                                number: domain.port,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
                ...(domain.useSsl === true && {
                    tls: [
                        {
                            hosts: [hostname],
                            secretName: `secret-tls-${domain.id}`,
                        },
                    ],
                }),
            },
        };

        await dlog(deploymentId, `Configuring Ingress with Domain ${domain.useSsl ? 'https' : 'http'}://${hostname} --> ${app.id}:${domain.port}`);
        if (existingIngress) {
            await k3s.network.replaceNamespacedIngress(ingressName, app.projectId, ingressDefinition);
            console.log(`Ingress ${ingressName} for domain ${hostname} successfully updated.`);
        } else {
            await k3s.network.createNamespacedIngress(app.projectId, ingressDefinition);
            console.log(`Ingress ${ingressName} for domain ${hostname} successfully created.`);
        }
    }
}

const ingressService = new IngressService();
export default ingressService;
