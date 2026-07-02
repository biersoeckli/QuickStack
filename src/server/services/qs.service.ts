import k3s, { kubernetesPatchOptions } from "../adapter/kubernetes-api.adapter";
import { V1Deployment, V1Ingress, V1Service } from "@kubernetes/client-node";
import namespaceService from "./namespace.service";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import crypto from "crypto";
import { FancyConsoleUtils } from "../../shared/utils/fancy-console.utils";
import standalonePodService from "./standalone-services/standalone-pod.service";
import ingressSetupService from "./setup-services/ingress-setup.service";

class QuickStackService {

    private readonly QUICKSTACK_NAMESPACE = 'quickstack';
    private readonly QUICKSTACK_DEPLOYMENT_NAME = 'quickstack';
    private readonly QUICKSTACK_PORT_NUMBER = 3000;
    private readonly QUICKSTACK_SERVICEACCOUNT_NAME = 'qs-service-account';
    private readonly CLUSTER_ISSUER_NAME = 'letsencrypt-production';

    getVersionOfCurrentQuickstackInstance() {
        return process.env.QS_VERSION || undefined;
    }

    async updateQuickStack(useCanaryChannel = false) {
        const existingDeployment = await this.getExistingDeployment();
        await this.createOrUpdateDeployment(existingDeployment.nextAuthSecret, useCanaryChannel ? 'canary' : 'latest');
    }

    async initializeQuickStack() {
        await namespaceService.createNamespaceIfNotExists(this.QUICKSTACK_NAMESPACE)
        const nextAuthSecret = await this.deleteExistingDeployment();
        await this.createOrUpdatePvc();
        await this.createOrUpdateDeployment(nextAuthSecret, process.env.QS_VERSION?.includes('canary') ? 'canary' : 'latest');
        await this.createOrUpdateService(true);
        await this.waitUntilQuickstackIsRunning();
        console.log('QuickStack successfully initialized');
        console.log('');
        console.log('------------------------------------------------');
        FancyConsoleUtils.printQuickStack();
        console.log('You can now access QuickStack UI on the following URL: http://SERVER-IP:30000');
        console.log('');
        console.log('');
        console.log('* Hint: Ensure that the port 30000 is open in your firewall.');
        console.log('');
        console.log('------------------------------------------------');
        console.log('');
    }

    async waitUntilQuickstackIsRunning() {
        console.log('Waiting for QuickStack to be running...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const pods = await standalonePodService.getPodsForApp(this.QUICKSTACK_NAMESPACE, this.QUICKSTACK_DEPLOYMENT_NAME);
        const quickStackPod = pods.find(p => p);
        if (!quickStackPod) {
            console.error('[ERROR] QuickStack pod was not found');
            return;
        }
        await standalonePodService.waitUntilPodIsRunningFailedOrSucceded(this.QUICKSTACK_NAMESPACE, quickStackPod.podName);
        if (standalonePodService) {
            console.log('QuickStack is now running');
        } else {
            console.warn('Could not verify if QuickStack is running, please check manually.');
        }
    }

    async createOrUpdateIngress(hostname: string) {

        await ingressSetupService.createTraefikRedirectMiddlewareIfNotExist();

        const ingressName = KubeObjectNameUtils.getIngressName(this.QUICKSTACK_NAMESPACE);
        const existingIngresses = await k3s.network.listNamespacedIngress({ namespace: this.QUICKSTACK_NAMESPACE });
        const existingIngress = existingIngresses.items.find((item) => item.metadata?.name === ingressName);

        const ingressDefinition: V1Ingress = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: ingressName,
                namespace: this.QUICKSTACK_NAMESPACE,
                annotations: {
                    'cert-manager.io/cluster-issuer': this.CLUSTER_ISSUER_NAME,
                    'traefik.ingress.kubernetes.io/router.middlewares': 'kube-system-redirect-to-https@kubernetescrd'  // activate redirect middleware for https
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
                                            name: KubeObjectNameUtils.toServiceName(this.QUICKSTACK_DEPLOYMENT_NAME),
                                            port: {
                                                number: this.QUICKSTACK_PORT_NUMBER,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
                tls: [
                    {
                        hosts: [hostname],
                        secretName: `secret-tls-${hostname}`,
                    },
                ],
            },
        };

        if (existingIngress) {
            await k3s.network.replaceNamespacedIngress({ name: ingressName, namespace: this.QUICKSTACK_NAMESPACE, body: ingressDefinition });
            console.log(`Ingress QuickStack for domain ${hostname} successfully updated.`);
        } else {
            await k3s.network.createNamespacedIngress({ namespace: this.QUICKSTACK_NAMESPACE, body: ingressDefinition });
            console.log(`Ingress QuickStack for domain ${hostname} successfully created.`);
        }
    }

    async createOrUpdateCertIssuer(letsencryptMail: string) {
        const now = new Date();
        const clusterIssuerBody = {
            apiVersion: 'cert-manager.io/v1',
            kind: 'ClusterIssuer',
            metadata: {
                name: this.CLUSTER_ISSUER_NAME,
                namespace: 'default',
                //resourceVersion: now.getTime().toString(),
            },
            spec: {
                acme: {
                    email: letsencryptMail,
                    server: 'https://acme-v02.api.letsencrypt.org/directory',
                    privateKeySecretRef: {
                        name: this.CLUSTER_ISSUER_NAME,
                    },
                    solvers: [
                        {
                            selector: {},
                            http01: {
                                ingress: {
                                    class: "traefik"
                                }
                            }
                        }
                    ]
                }
            }
        };


        if (await this.checkIfClusterIssuerExists()) {
            // update
            await k3s.customObjects.patchClusterCustomObject(
                { group: 'cert-manager.io', version: 'v1', plural: 'clusterissuers', name: this.CLUSTER_ISSUER_NAME, body: clusterIssuerBody },
                kubernetesPatchOptions('application/merge-patch+json'),
            );
        } else {
            // create
            await k3s.customObjects.createClusterCustomObject({ group: 'cert-manager.io', version: 'v1', plural: 'clusterissuers', body: clusterIssuerBody });
        }
    }


    async checkIfClusterIssuerExists() {
        const res = await k3s.customObjects.listClusterCustomObject({ group: 'cert-manager.io', version: 'v1', plural: 'clusterissuers' });
        if ((res as any) && (res as any)?.items && (res as any)?.items?.length > 0) {
            const existingLetsecryptProduction = (res as any).items.find((item: any) => item.metadata.name === this.CLUSTER_ISSUER_NAME);
            if (existingLetsecryptProduction) {
                return true;
            }
        }
        return false;
    }

    async createOrUpdateService(openNodePort = false) {
        const serviceName = KubeObjectNameUtils.toServiceName(this.QUICKSTACK_DEPLOYMENT_NAME);
        const body: V1Service = {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
                name: serviceName,
                namespace: this.QUICKSTACK_NAMESPACE,
            },
            spec: {
                selector: {
                    app: this.QUICKSTACK_DEPLOYMENT_NAME
                },
                ports: [
                    {
                        protocol: 'TCP',
                        port: this.QUICKSTACK_PORT_NUMBER,
                        targetPort: this.QUICKSTACK_PORT_NUMBER,
                        nodePort: openNodePort ? 30000 : undefined,
                    }
                ],
                type: openNodePort ? 'NodePort' : undefined
            }
        };

        const allServices = await k3s.core.listNamespacedService({ namespace: this.QUICKSTACK_NAMESPACE });
        const existingService = allServices.items.find(s => s.metadata!.name === serviceName);
        if (existingService) {
            console.warn('Service already exists, deleting and recreating it');
            await k3s.core.deleteNamespacedService({ name: serviceName, namespace: this.QUICKSTACK_NAMESPACE });
            console.log('Existing service deleted');
        } else {
            console.warn('Service does not exist, creating');
        }
        await k3s.core.createNamespacedService({ namespace: this.QUICKSTACK_NAMESPACE, body: body });
        console.log('Service created');
    }

    private async createOrUpdatePvc() {
        const pvcName = KubeObjectNameUtils.toPvcName(this.QUICKSTACK_DEPLOYMENT_NAME);
        const allPvcs = await k3s.core.listNamespacedPersistentVolumeClaim({ namespace: this.QUICKSTACK_NAMESPACE });
        const existingPvc = allPvcs.items.find(p => p.metadata!.name === pvcName);

        const storageClassName = existingPvc?.spec?.storageClassName || 'longhorn';

        const pvc = {
            apiVersion: 'v1',
            kind: 'PersistentVolumeClaim',
            metadata: {
                name: pvcName,
                namespace: this.QUICKSTACK_NAMESPACE
            },
            spec: {
                accessModes: ['ReadWriteOnce'],
                storageClassName,
                resources: {
                    requests: {
                        storage: '1Gi'
                    }
                }
            }
        };
        if (existingPvc) {
            if (existingPvc.spec!.resources!.requests!.storage === pvc.spec!.resources!.requests!.storage) {
                console.log(`PVC already exists with the same size, no changes`);
                return;
            }
            console.warn('PVC already exists, updating size');
            // Only the Size of PVC can be updated, so we need to delete and recreate the PVC
            // update PVC size
            existingPvc.spec!.resources!.requests!.storage = pvc.spec!.resources!.requests!.storage;
            await k3s.core.replaceNamespacedPersistentVolumeClaim({ name: pvcName, namespace: this.QUICKSTACK_NAMESPACE, body: existingPvc });
            console.log('PVC updated');
        } else {
            console.warn('PVC does not exist, creating');
            await k3s.core.createNamespacedPersistentVolumeClaim({ namespace: this.QUICKSTACK_NAMESPACE, body: pvc });
            console.log('PVC created');
        }
    }

    async createOrUpdateDeployment(inputNextAuthSecret?: string, imageTag = 'latest') {
        const generatedNextAuthSecret = crypto.randomBytes(32).toString('base64');
        const existingDeployment = await this.getExistingDeployment();
        const body: V1Deployment = {
            metadata: {
                name: this.QUICKSTACK_DEPLOYMENT_NAME,
            },
            spec: {
                replicas: 1,
                strategy: {
                    type: 'Recreate',
                },
                selector: {
                    matchLabels: {
                        app: this.QUICKSTACK_DEPLOYMENT_NAME
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            app: this.QUICKSTACK_DEPLOYMENT_NAME
                        },
                        annotations: {
                            deploymentTimestamp: new Date().getTime() + "",
                        }
                    },
                    spec: {
                        serviceAccountName: this.QUICKSTACK_SERVICEACCOUNT_NAME,
                        securityContext: {
                            runAsUser: 1001,
                            runAsGroup: 1001,
                            fsGroup: 1001
                        },
                        containers: [
                            {
                                name: this.QUICKSTACK_DEPLOYMENT_NAME,
                                image: `quickstack/quickstack:${imageTag}`,
                                imagePullPolicy: 'Always',
                                env: [
                                    {
                                        name: 'NEXTAUTH_SECRET',
                                        value: inputNextAuthSecret || existingDeployment.nextAuthSecret || generatedNextAuthSecret
                                    },
                                    ...process.env.K3S_JOIN_TOKEN ? [{
                                        name: 'K3S_JOIN_TOKEN',
                                        value: process.env.K3S_JOIN_TOKEN
                                    }] : []
                                ],
                                volumeMounts: [{
                                    name: 'quickstack-volume',
                                    mountPath: '/app/storage'
                                }]
                            }
                        ],
                        volumes: [{
                            name: 'quickstack-volume',
                            persistentVolumeClaim: {
                                claimName: KubeObjectNameUtils.toPvcName(this.QUICKSTACK_DEPLOYMENT_NAME)
                            }
                        }]
                    }
                }
            }
        };
        if (existingDeployment.existingDeployments) {
            await k3s.apps.replaceNamespacedDeployment({ name: this.QUICKSTACK_DEPLOYMENT_NAME, namespace: this.QUICKSTACK_NAMESPACE, body: body });
            console.log('Deployment updated');
        } else {
            await k3s.apps.createNamespacedDeployment({ namespace: this.QUICKSTACK_NAMESPACE, body: body });
            console.log('Deployment created');
        }
    }

    /**
     * @returns: the existing NEXTAUTH_SECRET if the deployment already exists
     */
    private async deleteExistingDeployment() {
        const { existingDeployments, nextAuthSecret } = await this.getExistingDeployment();
        const quickStackAlreadyDeployed = !!existingDeployments;
        if (quickStackAlreadyDeployed) {
            console.warn('QuickStack already deployed, deleting existing deployment (data wont be lost)');
            await k3s.apps.deleteNamespacedDeployment({ name: this.QUICKSTACK_DEPLOYMENT_NAME, namespace: this.QUICKSTACK_NAMESPACE });
            console.log('Existing deployment deleted');
        }
        return nextAuthSecret;
    }

    async getExistingDeployment() {
        const allDeployments = await k3s.apps.listNamespacedDeployment({ namespace: this.QUICKSTACK_NAMESPACE });
        const existingDeployments = allDeployments.items.find(d => d.metadata!.name === this.QUICKSTACK_DEPLOYMENT_NAME);
        const nextAuthSecret = existingDeployments?.spec?.template?.spec?.containers?.[0].env?.find(e => e.name === 'NEXTAUTH_SECRET')?.value;
        const nextAuthHostname = existingDeployments?.spec?.template?.spec?.containers?.[0].env?.find(e => e.name === 'NEXTAUTH_URL')?.value;
        const isCanaryDeployment = existingDeployments?.spec?.template?.spec?.containers?.[0].image?.includes('canary');
        return { existingDeployments, nextAuthSecret, nextAuthHostname, isCanaryDeployment };
    }
}

const quickStackService = new QuickStackService();
export default quickStackService;
