// @vitest-environment node

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import * as k8s from '@kubernetes/client-node';
import type { StartedK3sContainer } from '@testcontainers/k3s';
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';
import networkPolicyService from '@/server/services/network-policy.service';
import svcService from '@/server/services/svc.service';
import { KubeObjectNameUtils } from '@/server/utils/kube-object-name.utils';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { AppNetworkPolicyType } from '@/shared/model/network-policy.model';
import { Constants } from '@/shared/utils/constants';

const networkPolicyTypes: AppNetworkPolicyType[] = ['ALLOW_ALL', 'INTERNET_ONLY', 'NAMESPACE_ONLY', 'DENY_ALL'];
const networkPolicyCombinations = networkPolicyTypes.flatMap(ingressPolicy =>
    networkPolicyTypes.map(egressPolicy => [ingressPolicy, egressPolicy] as const));

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
            ingressNetworkPolicy: 'DENY_ALL',
            egressNetworkPolicy: 'DENY_ALL',
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
            ingressNetworkPolicy: 'ALLOW_ALL',
            egressNetworkPolicy: 'ALLOW_ALL',
            appNodePorts: [],
        }));

        const policy = await network.readNamespacedNetworkPolicy({ name: KubeObjectNameUtils.toNetworkPolicyName(appId), namespace: namespace });

        expect(policy.spec?.podSelector).toEqual({
            matchLabels: {
                app: appId,
            },
        });
        expect(policy.spec?.policyTypes).toEqual(['Ingress', 'Egress']);
        expect(policy.spec?.ingress).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _from: expect.arrayContaining([
                        { podSelector: {} },
                    ]),
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
            ingressNetworkPolicy: 'ALLOW_ALL',
            egressNetworkPolicy: 'ALLOW_ALL',
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

    it.each(networkPolicyCombinations)(
        'creates expected rules for ingress %s and egress %s',
        async (ingressPolicy, egressPolicy) => {
            const namespace = toKubeName(`policy-matrix-${ingressPolicy}-${egressPolicy}`);
            const appId = 'matrix-app';
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
                ingressNetworkPolicy: ingressPolicy,
                egressNetworkPolicy: egressPolicy,
                appNodePorts: [],
            }));

            const policy = await network.readNamespacedNetworkPolicy({ name: KubeObjectNameUtils.toNetworkPolicyName(appId), namespace: namespace });

            expectIngressRules(policy.spec?.ingress ?? [], ingressPolicy);
            expectEgressRules(policy.spec?.egress ?? [], egressPolicy);
        }
    );

    it('allows an nginx Deployment to be reached through a node on NodePort 30081', async () => {
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

        const response = await fetchNodePortFromK3sNode(ctx.getContainer(), 30081);
        expect(response.exitCode).toBe(0);
        expect(response.stdout).toContain('Welcome to nginx!');
    }, 180_000);
});

function createNetworkPolicyApp(overrides: Pick<AppExtendedModel,
    'id' |
    'projectId' |
    'useNetworkPolicy' |
    'ingressNetworkPolicy' |
    'egressNetworkPolicy' |
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
        appPorts: [],
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
        ingressNetworkPolicy: 'DENY_ALL',
        egressNetworkPolicy: 'DENY_ALL',
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
        appPorts: [],
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

function expectIngressRules(rules: k8s.V1NetworkPolicyIngressRule[], policyType: AppNetworkPolicyType) {
    const peers = rules.flatMap(rule => rule._from ?? []);
    const expectedPeers: Record<AppNetworkPolicyType, {
        traefik: boolean;
        namespace: boolean;
        backupJob: boolean;
        dbTool: boolean;
    }> = {
        ALLOW_ALL: {
            traefik: true,
            namespace: true,
            backupJob: false,
            dbTool: false,
        },
        INTERNET_ONLY: {
            traefik: true,
            namespace: false,
            backupJob: true,
            dbTool: true,
        },
        NAMESPACE_ONLY: {
            traefik: false,
            namespace: true,
            backupJob: false,
            dbTool: false,
        },
        DENY_ALL: {
            traefik: false,
            namespace: false,
            backupJob: true,
            dbTool: true,
        },
    };

    expect(hasTraefikIngressPeer(peers)).toBe(expectedPeers[policyType].traefik);
    expect(hasSameNamespacePeer(peers)).toBe(expectedPeers[policyType].namespace);
    expect(hasContainerTypePeer(peers, Constants.QS_ANNOTATION_CONTAINER_TYPE_DB_BACKUP_JOB))
        .toBe(expectedPeers[policyType].backupJob);
    expect(hasContainerTypePeer(peers, Constants.QS_ANNOTATION_CONTAINER_TYPE_DB_TOOL))
        .toBe(expectedPeers[policyType].dbTool);
}

function expectEgressRules(rules: k8s.V1NetworkPolicyEgressRule[], policyType: AppNetworkPolicyType) {
    const expectedRules: Record<AppNetworkPolicyType, {
        dns: boolean;
        internet: boolean;
        namespace: boolean;
    }> = {
        ALLOW_ALL: {
            dns: true,
            internet: true,
            namespace: true,
        },
        INTERNET_ONLY: {
            dns: true,
            internet: true,
            namespace: false,
        },
        NAMESPACE_ONLY: {
            dns: true,
            internet: false,
            namespace: true,
        },
        DENY_ALL: {
            dns: false,
            internet: false,
            namespace: false,
        },
    };

    expect(hasDnsEgressRule(rules)).toBe(expectedRules[policyType].dns);
    expect(hasInternetEgressPeer(rules)).toBe(expectedRules[policyType].internet);
    expect(hasSameNamespaceEgressPeer(rules)).toBe(expectedRules[policyType].namespace);
}

function hasTraefikIngressPeer(peers: k8s.V1NetworkPolicyPeer[]) {
    return peers.some(peer =>
        peer.namespaceSelector?.matchLabels?.['kubernetes.io/metadata.name'] === 'kube-system' &&
        peer.podSelector?.matchLabels?.['app.kubernetes.io/name'] === 'traefik');
}

function hasSameNamespacePeer(peers: k8s.V1NetworkPolicyPeer[]) {
    return peers.some(peer => isEmptySelector(peer.podSelector));
}

function hasContainerTypePeer(peers: k8s.V1NetworkPolicyPeer[], containerType: string) {
    return peers.some(peer =>
        peer.podSelector?.matchLabels?.[Constants.QS_ANNOTATION_CONTAINER_TYPE] === containerType);
}

function hasDnsEgressRule(rules: k8s.V1NetworkPolicyEgressRule[]) {
    return rules.some(rule => {
        const ports = rule.ports ?? [];
        const destinations = rule.to ?? [];
        return ports.some(port => port.protocol === 'UDP' && port.port === 53) &&
            ports.some(port => port.protocol === 'TCP' && port.port === 53) &&
            destinations.some(destination =>
                destination.namespaceSelector?.matchLabels?.['kubernetes.io/metadata.name'] === 'kube-system' &&
                destination.podSelector?.matchLabels?.['k8s-app'] === 'kube-dns') &&
            destinations.some(destination =>
                destination.namespaceSelector?.matchLabels?.['kubernetes.io/metadata.name'] === 'kube-system' &&
                destination.podSelector?.matchLabels?.['k8s-app'] === 'coredns');
    });
}

function hasInternetEgressPeer(rules: k8s.V1NetworkPolicyEgressRule[]) {
    return rules.some(rule =>
        (rule.to ?? []).some(destination =>
            destination.ipBlock?.cidr === '0.0.0.0/0' &&
            destination.ipBlock?.except?.includes('10.0.0.0/8') &&
            destination.ipBlock?.except?.includes('172.16.0.0/12') &&
            destination.ipBlock?.except?.includes('192.168.0.0/16')));
}

function hasSameNamespaceEgressPeer(rules: k8s.V1NetworkPolicyEgressRule[]) {
    return rules.some(rule =>
        (rule.to ?? []).some(destination =>
            isEmptySelector(destination.podSelector)));
}

function isEmptySelector(selector: k8s.V1LabelSelector | undefined) {
    return !!selector &&
        Object.keys(selector.matchLabels ?? {}).length === 0 &&
        (selector.matchExpressions ?? []).length === 0;
}

function toKubeName(value: string) {
    return value.toLowerCase().replace(/_/g, '-');
}

async function fetchNodePortFromK3sNode(container: StartedK3sContainer, nodePort: number) {
    let lastResponse: Awaited<ReturnType<StartedK3sContainer['exec']>> | undefined;
    for (let attempt = 0; attempt < 30; attempt++) {
        lastResponse = await container.exec([
            '/bin/sh',
            '-c',
            `wget -q -O - http://127.0.0.1:${nodePort}`,
        ]);
        if (lastResponse.exitCode === 0) {
            return lastResponse;
        }
        await sleep(1_000);
    }
    return lastResponse!;
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
