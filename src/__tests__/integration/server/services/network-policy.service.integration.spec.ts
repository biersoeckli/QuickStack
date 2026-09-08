// @vitest-environment node

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import * as k8s from '@kubernetes/client-node';
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';
import networkPolicyService from '@/server/services/network-policy.service';
import svcService from '@/server/services/svc.service';
import { KubeObjectNameUtils } from '@/server/utils/kube-object-name.utils';
import { AppExtendedModel } from '@/shared/model/app-extended.model';

describe('network-policy.service integration', () => {
    const ctx = createK3sTestContext();

    it('creates a NetworkPolicy that allows external ingress to App Node Ports', async () => {
        const namespace = 'node-port-policy-test';
        const { core, network } = ctx.getClients();
        await core.createNamespace({
            body: {
                metadata: {
                    name: namespace,
                },
            },
        });

        await networkPolicyService.reconcileNetworkPolicy({
            id: 'demo-app',
            projectId: namespace,
            useNetworkPolicy: true,
            appNodePorts: [
                {
                    id: 'node-port-1',
                    appId: 'demo-app',
                    port: 300,
                    nodePort: 30080,
                    protocol: 'TCP',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
        } as AppExtendedModel);

        const policy = await network.readNamespacedNetworkPolicy({ name: KubeObjectNameUtils.toNetworkPolicyName('demo-app'), namespace: namespace });

        expect(policy.spec?.ingress).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _from: [{ ipBlock: { cidr: '0.0.0.0/0' } }],
                    ports: [{ protocol: 'TCP', port: 300 }],
                }),
            ])
        );
    });

    it('creates a standard NetworkPolicy for a normal App with network policies enabled', async () => {
        const namespace = 'normal-app-policy-test';
        const appId = 'normal-app';
        const { core, network } = ctx.getClients();
        await core.createNamespace({
            body: {
                metadata: {
                    name: namespace,
                },
            },
        });

        await networkPolicyService.reconcileNetworkPolicy(createNetworkPolicyApp({
            id: appId,
            projectId: namespace,
            useNetworkPolicy: true,
            appNodePorts: [],
        }));

        const policy = await network.readNamespacedNetworkPolicy({ name: KubeObjectNameUtils.toNetworkPolicyName(appId), namespace: namespace });

        expect(policy.spec?.podSelector).toEqual({
            matchLabels: {
                app: appId,
            },
        });
        expect(policy.spec?.policyTypes).toEqual(['Ingress', 'Egress']);
        // an App can always be reached from its own replicas
        expect(policy.spec?.ingress).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _from: [{ podSelector: { matchLabels: { app: appId } } }],
                }),
            ])
        );
        // traffic from the whole namespace is not allowed by default
        expect(policy.spec?.ingress).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _from: [{ podSelector: {} }],
                }),
            ])
        );
        expect(policy.spec?.ingress).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _from: [{ ipBlock: { cidr: '0.0.0.0/0' } }],
                }),
            ])
        );
        // egress allows DNS and internet access by default
        const egressDestinations = (policy.spec?.egress ?? []).flatMap(rule => rule.to ?? []);
        expect(egressDestinations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } },
                    podSelector: { matchLabels: { 'k8s-app': 'kube-dns' } },
                }),
                expect.objectContaining({ ipBlock: expect.objectContaining({ cidr: '0.0.0.0/0' }) }),
            ])
        );
    });

    it('removes the NetworkPolicy when network policies are turned off for an App', async () => {
        const namespace = 'disabled-app-policy-test';
        const appId = 'disabled-policy-app';
        const { core, network } = ctx.getClients();
        await core.createNamespace({
            body: {
                metadata: {
                    name: namespace,
                },
            },
        });

        const enabledApp = createNetworkPolicyApp({
            id: appId,
            projectId: namespace,
            useNetworkPolicy: true,
            appNodePorts: [],
        });
        await networkPolicyService.reconcileNetworkPolicy(enabledApp);

        await expect(network.readNamespacedNetworkPolicy({ name: KubeObjectNameUtils.toNetworkPolicyName(appId), namespace: namespace }))
            .resolves
            .toBeDefined();

        await networkPolicyService.reconcileNetworkPolicy({
            ...enabledApp,
            useNetworkPolicy: false,
        });

        const policies = await network.listNamespacedNetworkPolicy({ namespace: namespace });
        expect(policies.items.map(policy => policy.metadata?.name))
            .not
            .toContain(KubeObjectNameUtils.toNetworkPolicyName(appId));
    });

    it('exposes an nginx Deployment through NodePort 30081', async () => {
        const app = createNginxApp();
        const { core, apps } = ctx.getClients();
        await core.createNamespace({
            body: {
                metadata: {
                    name: app.projectId,
                },
            },
        });

        await apps.createNamespacedDeployment({ namespace: app.projectId, body: {
                    metadata: {
                        name: app.id,
                    },
                    spec: {
                        replicas: 1,
                        selector: {
                            matchLabels: {
                                app: app.id,
                            },
                        },
                        template: {
                            metadata: {
                                labels: {
                                    app: app.id,
                                },
                            },
                            spec: {
                                containers: [
                                    {
                                        name: 'nginx',
                                        image: 'nginx:1.27-alpine',
                                        ports: [
                                            {
                                                containerPort: 80,
                                                protocol: 'TCP',
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                } });

        await svcService.createOrUpdateServiceForApp('deployment-1', app);
        await networkPolicyService.reconcileNetworkPolicy(app);

        const deployment = await waitForDeploymentAvailable(apps, app.projectId, app.id);
        expect(deployment.status?.availableReplicas).toBe(1);

        const service = await core.readNamespacedService({
            name: KubeObjectNameUtils.toServiceName(app.id),
            namespace: app.projectId,
        });
        expect(service.spec?.type).toBe('NodePort');
        expect(service.spec?.ports).toEqual(expect.arrayContaining([
            expect.objectContaining({ port: 80, targetPort: 80, nodePort: 30081, protocol: 'TCP' }),
        ]));

        await expect.poll(async () =>
            await core.readNamespacedEndpoints({
                name: KubeObjectNameUtils.toServiceName(app.id),
                namespace: app.projectId,
            }),
        ).toMatchObject({
            subsets: [expect.objectContaining({
                addresses: [expect.objectContaining({ ip: expect.any(String) })],
                ports: [expect.objectContaining({ port: 80, protocol: 'TCP' })],
            })],
        });
    }, 180_000);
});

function createNetworkPolicyApp(overrides: Pick<AppExtendedModel,
    'id' |
    'projectId' |
    'useNetworkPolicy' |
    'appNodePorts'
>): AppExtendedModel {
    return {
        ...createNginxApp(),
        project: {
            id: overrides.projectId,
            name: overrides.projectId,
            projectType: 'APP',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        name: overrides.id,
        sourceType: 'CONTAINER',
        containerImageSource: 'nginx:1.27-alpine',
        appDomains: [],
        appVolumes: [],
        appFileMounts: [],
        appBasicAuths: [],
        ...overrides,
    };
}

function createNginxApp(): AppExtendedModel {
    return {
        id: 'nginx-node-port-app',
        name: 'Nginx Node Port App',
        appType: 'APP',
        projectId: 'nginx-node-port-test',
        project: {
            id: 'nginx-node-port-test',
            name: 'Nginx Node Port Test',
            projectType: 'APP',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        sourceType: 'CONTAINER',
        buildMethod: 'RAILPACK',
        containerImageSource: 'nginx:1.27-alpine',
        containerRegistryUsername: null,
        containerRegistryPassword: null,
        containerCommand: null,
        containerArgs: null,
        securityContextRunAsUser: null,
        securityContextRunAsGroup: null,
        securityContextFsGroup: null,
        securityContextPrivileged: false,
        gitUrl: null,
        gitBranch: null,
        gitUsername: null,
        gitToken: null,
        dockerfilePath: './Dockerfile',
        replicas: 1,
        envVars: '',
        memoryReservation: null,
        memoryLimit: null,
        cpuReservation: null,
        cpuLimit: null,
        webhookId: null,
        useNetworkPolicy: true,
        healthChechHttpGetPath: null,
        healthCheckHttpScheme: null,
        healthCheckHttpHeadersJson: null,
        healthCheckHttpPort: null,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        healthCheckTcpPort: null,
        appDomains: [],
        appNodePorts: [
            {
                id: 'nginx-node-port',
                appId: 'nginx-node-port-app',
                port: 80,
                nodePort: 30081,
                protocol: 'TCP',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
        appVolumes: [],
        appFileMounts: [],
        appBasicAuths: [],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

async function waitForDeploymentAvailable(
    apps: k8s.AppsV1Api,
    namespace: string,
    name: string
) {
    return await waitFor(async () => {
        const deployment = await apps.readNamespacedDeployment({ name: name, namespace: namespace });
        const status = deployment.status;
        const available = status?.conditions?.some(condition =>
            condition.type === 'Available' && condition.status === 'True');
        if (available && status?.readyReplicas === 1 && status?.availableReplicas === 1) {
            return deployment;
        }
        return undefined;
    }, `Deployment ${name} was not deployed in namespace ${namespace}.`);
}

async function waitFor<T>(predicate: () => Promise<T | undefined>, message: string): Promise<T> {
    for (let attempt = 0; attempt < 60; attempt++) {
        const result = await predicate();
        if (result) {
            return result;
        }
        await sleep(1_000);
    }
    throw new Error(message);
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
