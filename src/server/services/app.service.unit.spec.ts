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
        client: (() => {
            const client = {
            project: { findUnique: vi.fn() },
            app: { create: vi.fn(), update: vi.fn() },
            appDomain: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
            appVolume: { deleteMany: vi.fn() },
            appFileMount: { deleteMany: vi.fn() },
            appPort: { create: vi.fn(), deleteMany: vi.fn() },
            appNodePort: { deleteMany: vi.fn() },
            appBasicAuth: { deleteMany: vi.fn() },
                $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(client)),
            };
            return client;
        })(),
    },
}));
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/services/deployment.service', () => ({
    default: {
        getDeploymentHistoryEntryById: vi.fn(),
        createDeployment: vi.fn(),
    },
}));
vi.mock('@/server/services/build.service', () => ({
    default: {
        buildApp: vi.fn(),
        buildAppAtCommit: vi.fn(),
    },
}));
vi.mock('@/server/services/registry.service', () => ({
    default: {
        doesImageExist: vi.fn(),
    },
}));
vi.mock('@/server/services/ingress.service', () => ({ default: {} }));
vi.mock('@/server/services/pvc.service', () => ({ default: {} }));
vi.mock('@/server/services/svc.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment-logs.service', () => ({
    default: {
        catchErrosAndLog: vi.fn(async (_id: string, fn: () => Promise<void>) => fn()),
    },
    dlog: vi.fn(),
}));
vi.mock('@/server/services/network-policy.service', () => ({ default: {} }));
vi.mock('@/server/services/app-network-policy.service', () => ({ default: { replaceConfiguration: vi.fn() } }));

import appService from './app.service';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import dataAccess from '@/server/adapter/db.client';
import deploymentService from './deployment.service';
import buildService from './build.service';
import registryService from './registry.service';

describe('app.service', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
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
        await appService.saveAppExtendedModel({ ...app, appNetworkPolicy: app.appNetworkPolicy ?? null });

        expect(saveNodePort).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'node-port-1',
                appId: 'demo-app',
                port: 300,
                nodePort: 30080,
                protocol: 'TCP',
            }),
            expect.any(Object)
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

    it('rejects moving an App Domain from another App by id', async () => {
        vi.spyOn(appService, 'getExtendedById').mockResolvedValue(createApp({
            id: 'target-app',
        }) as never);
        vi.mocked(dataAccess.client.appDomain.findFirst)
            .mockResolvedValueOnce({
                id: 'domain-from-other-app',
                appId: 'source-app',
                hostname: 'example.com',
                port: 80,
                useSsl: true,
                redirectHttps: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .mockResolvedValueOnce(null);

        await expect(appService.saveDomain({
            id: 'domain-from-other-app',
            appId: 'target-app',
            hostname: 'example.com',
            port: 80,
            useSsl: true,
            redirectHttps: true,
        })).rejects.toThrow('App domain has ID, but existing item for app was not found.');

        expect(dataAccess.client.appDomain.update).not.toHaveBeenCalled();
    });

    it('redeploys an existing commit image when rolling back to a deployment with a cached image', async () => {
        vi.spyOn(appService, 'getExtendedById').mockResolvedValue(createApp({ sourceType: 'GIT' }) as never);
        vi.mocked(deploymentService.getDeploymentHistoryEntryById).mockResolvedValue({
            deploymentId: 'target-1',
            createdAt: new Date(),
            status: 'DEPLOYED',
            gitCommit: 'abcdef1234567890',
            gitCommitMessage: 'old commit',
            buildMethod: 'RAILPACK',
        } as never);
        vi.mocked(registryService.doesImageExist).mockResolvedValue(true);

        await appService.rollbackToDeployment('demo-app', 'target-1');

        expect(deploymentService.createDeployment).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ id: 'demo-app' }),
            undefined,
            'abcdef1234567890',
            'old commit',
            'RAILPACK',
            true,
        );
        expect(buildService.buildAppAtCommit).not.toHaveBeenCalled();
    });

    it('builds the commit when rolling back to a deployment whose image is missing', async () => {
        vi.spyOn(appService, 'getExtendedById').mockResolvedValue(createApp({ sourceType: 'GIT' }) as never);
        vi.mocked(deploymentService.getDeploymentHistoryEntryById).mockResolvedValue({
            deploymentId: 'target-1',
            createdAt: new Date(),
            status: 'DEPLOYED',
            gitCommit: 'abcdef1234567890',
            gitCommitMessage: 'old commit',
            buildMethod: 'RAILPACK',
        } as never);
        vi.mocked(registryService.doesImageExist).mockResolvedValue(false);

        await appService.rollbackToDeployment('demo-app', 'target-1');

        expect(buildService.buildAppAtCommit).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ id: 'demo-app' }),
            'abcdef1234567890',
            'old commit',
            true,
        );
        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
    });

    it('rejects a rollback to a deployment without a git commit', async () => {
        vi.spyOn(appService, 'getExtendedById').mockResolvedValue(createApp({ sourceType: 'GIT' }) as never);
        vi.mocked(deploymentService.getDeploymentHistoryEntryById).mockResolvedValue({
            deploymentId: 'target-1',
            createdAt: new Date(),
            status: 'DEPLOYED',
        } as never);

        await expect(appService.rollbackToDeployment('demo-app', 'target-1'))
            .rejects.toThrow('The selected deployment has no git commit to roll back to.');

        expect(registryService.doesImageExist).not.toHaveBeenCalled();
        expect(buildService.buildAppAtCommit).not.toHaveBeenCalled();
        expect(deploymentService.createDeployment).not.toHaveBeenCalled();
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
