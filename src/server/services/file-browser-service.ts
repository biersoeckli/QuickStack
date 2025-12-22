import { V1Deployment, V1Ingress } from "@kubernetes/client-node";
import dataAccess from "../adapter/db.client";
import { Constants } from "@/shared/utils/constants";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import deploymentService from "./deployment.service";
import k3s from "../adapter/kubernetes-api.adapter";
import ingressService from "./ingress.service";
import svcService from "./svc.service";
import { randomBytes } from "crypto";
import podService from "./pod.service";
import bcrypt from "bcrypt";
import hostnameDnsProviderService from "./hostname-dns-provider.service";
import pvcService from "./pvc.service";
import networkPolicyService from "./network-policy.service";

class FileBrowserService {

    async deployFileBrowserForVolume(volumeId: string) {
        const volume = await dataAccess.client.appVolume.findFirstOrThrow({
            where: {
                id: volumeId
            },
            include: {
                app: true
            }
        });

        const kubeAppName = `fb-${volumeId}`; // filebrowser-app
        const namespace = volume.app.projectId;
        const appId = volume.app.id;
        const projectId = volume.app.projectId;

        console.log('Shutting down application with id: ' + appId);
        await deploymentService.setReplicasToZeroAndWaitForShutdown(projectId, appId);

        console.log(`Creating PVC if not already created for volume ${volumeId}`);
        await pvcService.createPvcForVolumeIfNotExists(volume.app.projectId, volume);

        console.log(`Deploying filebrowser for volume ${volumeId}`);
        const traefikHostname = await hostnameDnsProviderService.getDomainForApp(volume.id);

        const pvcName = KubeObjectNameUtils.toPvcName(volume.id);

        console.log(`Creating filebrowser deployment for volume ${volumeId}`);

        const randomPassword = randomBytes(15).toString('hex');
        await this.createOrUpdateFilebrowserDeployment(kubeAppName, appId, projectId, pvcName, randomPassword);

        console.log(`Creating service for filebrowser for volume ${volumeId}`);
        await svcService.createOrUpdateService(projectId, kubeAppName, [{
            name: 'http',
            port: 80,
            targetPort: 80,
        }]);

        console.log(`Creating ingress for filebrowser for volume ${volumeId}`);
        await this.createOrUpdateIngress(kubeAppName, namespace, appId, projectId, traefikHostname);

        console.log(`Creating network policy for filebrowser for volume ${volumeId}`);
        await networkPolicyService.reconcileFileBrowserNetworkPolicy(kubeAppName, projectId);

        const fileBrowserPods = await podService.getPodsForApp(projectId, kubeAppName);
        for (const pod of fileBrowserPods) {
            await podService.waitUntilPodIsRunningFailedOrSucceded(projectId, pod.podName);
        }

        // return `https://${randomUsername}:${randomPassword}@${traefikHostname}`;
        return { url: `https://${traefikHostname}`, password: randomPassword };
    }

    async deleteFileBrowserForVolumeIfExists(volumeId: string) {
        const volume = await dataAccess.client.appVolume.findFirst({
            where: {
                id: volumeId
            },
            include: {
                app: true
            }
        });

        if (!volume) {
            return;
        }

        const kubeAppName = `fb-${volumeId}`; // filebrowser-app
        const projectId = volume.app.projectId;

        const existingDeployment = await deploymentService.getDeployment(projectId, kubeAppName);
        if (existingDeployment) { await k3s.apps.deleteNamespacedDeployment(kubeAppName, projectId); }

        const existingService = await svcService.getService(projectId, kubeAppName);
        if (existingService) { await svcService.deleteService(projectId, kubeAppName); }


        const existingIngress = await ingressService.getIngressByName(projectId, kubeAppName);
        if (existingIngress) {
            await k3s.network.deleteNamespacedIngress(KubeObjectNameUtils.getIngressName(kubeAppName), projectId);
        }

        await networkPolicyService.deleteFileBrowserNetworkPolicy(kubeAppName, projectId);
    }

    private async createOrUpdateIngress(kubeAppName: string, namespace: string, appId: string, projectId: string, traefikHostname: string) {
        const ingressDefinition: V1Ingress = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: KubeObjectNameUtils.getIngressName(kubeAppName),
                namespace: namespace,
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: appId,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: projectId,
                },
            },
            spec: {
                ingressClassName: 'traefik',
                rules: [
                    {
                        host: traefikHostname,
                        http: {
                            paths: [
                                {
                                    path: '/',
                                    pathType: 'Prefix',
                                    backend: {
                                        service: {
                                            name: KubeObjectNameUtils.toServiceName(kubeAppName),
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
                    hosts: [traefikHostname],
                    secretName: Constants.TRAEFIK_ME_SECRET_NAME,
                }],
            },
        };

        const existingIngress = await ingressService.getIngressByName(projectId, kubeAppName);
        if (existingIngress) {
            await k3s.network.replaceNamespacedIngress(KubeObjectNameUtils.getIngressName(kubeAppName), projectId, ingressDefinition);
        } else {
            await k3s.network.createNamespacedIngress(projectId, ingressDefinition);
        }
    }

    private async createOrUpdateFilebrowserDeployment(kubeAppName: string, appId: string, projectId: string, pvcName: string, authPassword: string) {

        const password = authPassword;
        const hashedPassword = await bcrypt.hash(password, 10);

        const body: V1Deployment = {
            metadata: {
                name: kubeAppName
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        app: kubeAppName
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            app: kubeAppName
                        },
                        annotations: {
                            [Constants.QS_ANNOTATION_APP_ID]: appId,
                            [Constants.QS_ANNOTATION_PROJECT_ID]: projectId,
                            deploymentTimestamp: new Date().getTime() + "",
                            "kubernetes.io/change-cause": `Deployment ${new Date().toISOString()}`
                        }
                    },
                    spec: {
                        containers: [
                            {
                                name: kubeAppName,
                                image: 'filebrowser/filebrowser:v2.31.2',
                                imagePullPolicy: 'Always',
                                /*args: [
                                    // ...existing code...
                                    "--commands",
                                    "cp,apk,rm,ls,mv"
                                ],*/
                                volumeMounts: [
                                    {
                                        name: 'fb-data',
                                        mountPath: '/srv/volume',
                                    }
                                ],
                                // source: https://filebrowser.org/cli/filebrowser
                                env: [
                                    {
                                        name: 'FB_USERNAME',
                                        value: 'quickstack'
                                    },
                                    {
                                        name: 'FB_PASSWORD',
                                        value: hashedPassword
                                    }
                                ]

                            }
                        ],
                        volumes: [
                            {
                                name: 'fb-data',
                                persistentVolumeClaim: {
                                    claimName: pvcName
                                }
                            }
                        ]
                    }
                }
            }
        };

        const existingDeployment = await deploymentService.getDeployment(projectId, kubeAppName);
        if (existingDeployment) {
            await k3s.apps.replaceNamespacedDeployment(kubeAppName, projectId, body);
        } else {
            await k3s.apps.createNamespacedDeployment(projectId, body);
        }
    }
}

const fileBrowserService = new FileBrowserService();
export default fileBrowserService;