vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: vi.fn().mockImplementation(
        (fn: (...args: unknown[]) => Promise<unknown>) =>
            (...args: unknown[]) =>
                fn(...args)
    ),
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            project: { findUnique: vi.fn() },
            app: { create: vi.fn(), update: vi.fn() },
            appPort: { create: vi.fn() },
        },
    },
}));
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/services/deployment.service', () => ({ default: {} }));
vi.mock('@/server/services/build.service', () => ({ default: {} }));
vi.mock('@/server/services/ingress.service', () => ({ default: {} }));
vi.mock('@/server/services/pvc.service', () => ({ default: {} }));
vi.mock('@/server/services/svc.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment-logs.service', () => ({ default: {}, dlog: vi.fn() }));
vi.mock('@/server/services/network-policy.service', () => ({ default: {} }));

import appService from './app.service';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import dataAccess from '@/server/adapter/db.client';

describe('app.service', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('persists App Node Ports when saving an extended App', async () => {
        vi.spyOn(appService, 'save').mockResolvedValue({ id: 'demo-app' } as never);
        vi.spyOn(appService, 'saveDomain').mockResolvedValue({} as never);
        vi.spyOn(appService, 'saveVolume').mockResolvedValue({} as never);
        vi.spyOn(appService, 'saveFileMount').mockResolvedValue({} as never);
        vi.spyOn(appService, 'savePort').mockResolvedValue({} as never);
        vi.spyOn(appService, 'saveBasicAuth').mockResolvedValue({} as never);
        vi.spyOn(appService, 'getExtendedById').mockResolvedValue(createApp({}) as never);
        const saveNodePort = vi.spyOn(appService, 'saveNodePort').mockResolvedValue({} as never);

        await appService.saveAppExtendedModel(createApp({
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
        }));

        expect(saveNodePort).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'node-port-1',
                appId: 'demo-app',
                port: 300,
                nodePort: 30080,
                protocol: 'TCP',
            }),
            undefined
        );
    });

    it('rejects App creation in an Agent Project', async () => {
        vi.mocked(dataAccess.client.project.findUnique).mockResolvedValue({
            id: 'proj-agents',
            name: 'Agents',
            projectType: 'AGENT',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await expect(appService.save({
            name: 'Wrong Workload',
            projectId: 'proj-agents',
        })).rejects.toThrow('Apps can only be created in App Projects.');

        expect(dataAccess.client.app.create).not.toHaveBeenCalled();
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
        appPorts: [],
        appNodePorts: [],
        appVolumes: [],
        appFileMounts: [],
        appBasicAuths: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}
