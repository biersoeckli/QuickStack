const k3sMocks = vi.hoisted(() => ({
    listNamespacedService: vi.fn(),
    readNamespacedService: vi.fn(),
    createNamespacedService: vi.fn(),
    replaceNamespacedService: vi.fn(),
    deleteNamespacedService: vi.fn(),
}));

const logMocks = vi.hoisted(() => ({
    dlog: vi.fn(),
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: {
            listNamespacedService: k3sMocks.listNamespacedService,
            readNamespacedService: k3sMocks.readNamespacedService,
            createNamespacedService: k3sMocks.createNamespacedService,
            replaceNamespacedService: k3sMocks.replaceNamespacedService,
            deleteNamespacedService: k3sMocks.deleteNamespacedService,
        },
    },
}));

vi.mock('@/server/services/deployment-logs.service', () => ({
    dlog: logMocks.dlog,
}));

import svcService from './svc.service';
import { AppExtendedModel } from '@/shared/model/app-extended.model';

describe('svc.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        k3sMocks.listNamespacedService.mockResolvedValue({ items: [] });
    });

    it('creates a NodePort service for an App with only an App Node Port', async () => {
        const app = createApp({
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
        });

        await svcService.createOrUpdateServiceForApp('deployment-1', app);

        expect(k3sMocks.createNamespacedService).toHaveBeenCalledTimes(1);
        const service = k3sMocks.createNamespacedService.mock.calls[0][0].body;
        expect(service.spec).toMatchObject({
            type: 'NodePort',
            ports: [
                {
                    name: 'nodeport-node-port-1',
                    port: 300,
                    targetPort: 300,
                    nodePort: 30080,
                    protocol: 'TCP',
                },
            ],
        });
    });

    it('merges an App Node Port into an ingress rule for the same container port and protocol', async () => {
        const app = createApp({
            appNetworkPolicy: {
                id: 'policy-1', appId: 'demo-app', allowInternetAccess: true,
                createdAt: new Date(), updatedAt: new Date(),
                rules: [{
                    id: 'rule-1', appNetworkPolicyId: 'policy-1', type: 'INGRESS', port: 300, protocol: 'UDP',
                    targetAppId: null, targetAgentId: null, targetApp: null, targetAgent: null,
                    createdAt: new Date(), updatedAt: new Date(),
                }],
            },
            appNodePorts: [
                {
                    id: 'node-port-1',
                    appId: 'demo-app',
                    port: 300,
                    nodePort: 30080,
                    protocol: 'UDP',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
        });

        await svcService.createOrUpdateServiceForApp('deployment-1', app);

        const service = k3sMocks.createNamespacedService.mock.calls[0][0].body;
        expect(service.spec).toMatchObject({
            type: 'NodePort',
            ports: [
                {
                    name: 'ingress-port-UDP-300',
                    port: 300,
                    targetPort: 300,
                    nodePort: 30080,
                    protocol: 'UDP',
                },
            ],
        });
    });

    it('deduplicates domain and ingress ports by port and protocol', async () => {
        const app = createApp({
            appDomains: [{ id: 'domain-1', appId: 'demo-app', hostname: 'demo.example.com', port: 443, useSsl: true, redirectHttps: true, createdAt: new Date(), updatedAt: new Date() }],
            appNetworkPolicy: {
                id: 'policy-1', appId: 'demo-app', allowInternetAccess: true, createdAt: new Date(), updatedAt: new Date(),
                rules: [
                    { id: 'rule-tcp', appNetworkPolicyId: 'policy-1', type: 'INGRESS', port: 443, protocol: 'TCP', targetAppId: null, targetAgentId: null, targetApp: null, targetAgent: null, createdAt: new Date(), updatedAt: new Date() },
                    { id: 'rule-udp', appNetworkPolicyId: 'policy-1', type: 'INGRESS', port: 443, protocol: 'UDP', targetAppId: null, targetAgentId: null, targetApp: null, targetAgent: null, createdAt: new Date(), updatedAt: new Date() },
                ],
            },
        });

        await svcService.createOrUpdateServiceForApp('deployment-1', app);

        expect(k3sMocks.createNamespacedService.mock.calls[0][0].body.spec.ports).toEqual([
            expect.objectContaining({ name: 'domain-port-domain-1', port: 443, protocol: 'TCP' }),
            expect.objectContaining({ name: 'ingress-port-UDP-443', port: 443, protocol: 'UDP' }),
        ]);
    });

    it('deletes an existing service when no domain, ingress rule, or NodePort remains', async () => {
        k3sMocks.listNamespacedService.mockResolvedValue({ items: [{ metadata: { name: 'svc-demo-app' } }] });
        k3sMocks.readNamespacedService.mockResolvedValue({});

        await svcService.createOrUpdateServiceForApp('deployment-1', createApp({}));

        expect(k3sMocks.deleteNamespacedService).toHaveBeenCalledWith({ name: 'svc-demo-app', namespace: 'demo-project' });
    });
});

function createApp(overrides: Partial<AppExtendedModel>): AppExtendedModel {
    return {
        id: 'demo-app',
        name: 'Demo App',
        appType: 'APP',
        projectId: 'demo-project',
        project: {
            id: 'demo-project',
            name: 'Demo Project',
            projectType: 'APP',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        sourceType: 'CONTAINER',
        buildMethod: 'RAILPACK',
        containerImageSource: null,
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
        ingressNetworkPolicy: 'ALLOW_ALL',
        egressNetworkPolicy: 'ALLOW_ALL',
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
        appNodePorts: [],
        appVolumes: [],
        appFileMounts: [],
        appBasicAuths: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}
