// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/services/deployment.service', () => ({ default: {} }));
vi.mock('@/server/services/build.service', () => ({ default: {} }));
vi.mock('@/server/services/ingress.service', () => ({ default: {} }));
vi.mock('@/server/services/pvc.service', () => ({ default: {} }));
vi.mock('@/server/services/svc.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment-logs.service', () => ({ default: {}, dlog: vi.fn() }));
vi.mock('@/server/services/network-policy.service', () => ({ default: {} }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import appService from '@/server/services/app.service';
import dataAccess from '@/server/adapter/db.client';
import { AppExtendedWriteModel } from '@/shared/model/app-extended.model';

describe('app.service integration - subitem ownership guards', () => {
    createPrismaTestContext('app-service-subitem-ownership');

    async function createProjectAndApps() {
        const project = await dataAccess.client.project.create({
            data: { name: 'App Project', projectType: 'APP' },
        });
        const sourceApp = await dataAccess.client.app.create({
            data: { id: 'source-app', name: 'Source App', projectId: project.id },
        });
        const targetApp = await dataAccess.client.app.create({
            data: { id: 'target-app', name: 'Target App', projectId: project.id },
        });
        return { sourceApp, targetApp };
    }

    it('rejects moving an App Domain to another App by id', async () => {
        const { sourceApp, targetApp } = await createProjectAndApps();
        const domain = await dataAccess.client.appDomain.create({
            data: { appId: sourceApp.id, hostname: 'source.example.com', port: 8080, useSsl: true, redirectHttps: true },
        });

        await expect(appService.saveDomain({
            id: domain.id,
            appId: targetApp.id,
            hostname: 'target.example.com',
            port: 8080,
            useSsl: true,
            redirectHttps: true,
        })).rejects.toThrow('App domain has ID, but existing item for app was not found.');

        await expect(dataAccess.client.appDomain.findUniqueOrThrow({ where: { id: domain.id } }))
            .resolves.toMatchObject({ appId: sourceApp.id, hostname: 'source.example.com' });
    });

    it('rejects moving an App Volume to another App by id', async () => {
        const { sourceApp, targetApp } = await createProjectAndApps();
        const volume = await dataAccess.client.appVolume.create({
            data: { appId: sourceApp.id, containerMountPath: '/data', size: 1 },
        });

        await expect(appService.saveVolume({
            id: volume.id,
            appId: targetApp.id,
            containerMountPath: '/data-copy',
            size: 2,
            accessMode: 'rwo',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        })).rejects.toThrow('App volume has ID, but existing item for app was not found.');

        await expect(dataAccess.client.appVolume.findUniqueOrThrow({ where: { id: volume.id } }))
            .resolves.toMatchObject({ appId: sourceApp.id, containerMountPath: '/data' });
    });

    it('rejects moving an App File Mount to another App by id', async () => {
        const { sourceApp, targetApp } = await createProjectAndApps();
        const fileMount = await dataAccess.client.appFileMount.create({
            data: { appId: sourceApp.id, containerMountPath: '/config.json', content: '{}' },
        });

        await expect(appService.saveFileMount({
            id: fileMount.id,
            appId: targetApp.id,
            containerMountPath: '/config-copy.json',
            content: '{"copy":true}',
        })).rejects.toThrow('App file mount has ID, but existing item for app was not found.');

        await expect(dataAccess.client.appFileMount.findUniqueOrThrow({ where: { id: fileMount.id } }))
            .resolves.toMatchObject({ appId: sourceApp.id, containerMountPath: '/config.json' });
    });

    it('rejects moving an App Node Port to another App by id', async () => {
        const { sourceApp, targetApp } = await createProjectAndApps();
        const nodePort = await dataAccess.client.appNodePort.create({
            data: { appId: sourceApp.id, port: 3000, nodePort: 30080, protocol: 'TCP' },
        });

        await expect(appService.saveNodePort({
            id: nodePort.id,
            appId: targetApp.id,
            port: 3001,
            nodePort: 30081,
            protocol: 'TCP',
        })).rejects.toThrow('App node port has ID, but existing item for app was not found.');

        await expect(dataAccess.client.appNodePort.findUniqueOrThrow({ where: { id: nodePort.id } }))
            .resolves.toMatchObject({ appId: sourceApp.id, port: 3000, nodePort: 30080 });
    });

    it('rejects moving an App Basic Auth entry to another App by id', async () => {
        const { sourceApp, targetApp } = await createProjectAndApps();
        const basicAuth = await dataAccess.client.appBasicAuth.create({
            data: { appId: sourceApp.id, username: 'source-user', password: 'source-pass' },
        });

        await expect(appService.saveBasicAuth({
            id: basicAuth.id,
            appId: targetApp.id,
            username: 'target-user',
            password: 'target-pass',
        })).rejects.toThrow('App basic auth has ID, but existing item for app was not found.');

        await expect(dataAccess.client.appBasicAuth.findUniqueOrThrow({ where: { id: basicAuth.id } }))
            .resolves.toMatchObject({ appId: sourceApp.id, username: 'source-user' });
    });

    it('rolls back created App when a nested subitem save fails', async () => {
        const { sourceApp } = await createProjectAndApps();
        await dataAccess.client.appDomain.create({
            data: { appId: sourceApp.id, hostname: 'taken.example.com', port: 8080, useSsl: true, redirectHttps: true },
        });

        await expect(appService.saveAppExtendedModel(createAppPayload(sourceApp.projectId, 'Rollback App', 'taken.example.com')))
            .rejects.toThrow('Hostname is already in use by this or another app.');

        await expect(dataAccess.client.app.findUnique({ where: { id: 'app-rollback-app' } }))
            .resolves.toBeNull();
    });

    it('preserves network policy rule IDs when saving an extended App', async () => {
        const { sourceApp, targetApp } = await createProjectAndApps();
        const policy = await dataAccess.client.appNetworkPolicy.create({
            data: { appId: sourceApp.id, allowInternetAccess: true },
        });
        const rule = await dataAccess.client.appNetworkPolicyRule.create({
            data: {
                appNetworkPolicyId: policy.id,
                targetAppId: targetApp.id,
                type: 'EGRESS',
                port: 443,
                protocol: 'TCP',
            },
        });

        const savedApp = await appService.saveAppExtendedModel({
            ...createAppPayload(sourceApp.projectId, sourceApp.name, 'source.example.com'),
            id: sourceApp.id,
            appNetworkPolicy: {
                allowInternetAccess: false,
                rules: [{
                    id: rule.id,
                    targetAppId: targetApp.id,
                    targetAgentId: null,
                    type: 'EGRESS',
                    port: 8443,
                    protocol: 'TCP',
                }],
            },
        });

        expect(savedApp.appNetworkPolicy).toMatchObject({
            allowInternetAccess: false,
            rules: [expect.objectContaining({ id: rule.id, port: 8443 })],
        });
    });

    it('rejects self-referencing network policy rules in an extended App save', async () => {
        const { sourceApp } = await createProjectAndApps();

        await expect(appService.saveAppExtendedModel({
            ...createAppPayload(sourceApp.projectId, sourceApp.name, 'source.example.com'),
            id: sourceApp.id,
            appNetworkPolicy: {
                allowInternetAccess: true,
                rules: [{
                    targetAppId: sourceApp.id,
                    targetAgentId: null,
                    type: 'EGRESS',
                    port: 443,
                    protocol: 'TCP',
                }],
            },
        })).rejects.toThrow('An app cannot reference itself.');
    });

    it('rejects duplicate network policy rules in an extended App save', async () => {
        const { sourceApp, targetApp } = await createProjectAndApps();
        const rule = {
            targetAppId: targetApp.id,
            targetAgentId: null,
            type: 'EGRESS' as const,
            port: 443,
            protocol: 'TCP' as const,
        };

        await expect(appService.saveAppExtendedModel({
            ...createAppPayload(sourceApp.projectId, sourceApp.name, 'source.example.com'),
            id: sourceApp.id,
            appNetworkPolicy: {
                allowInternetAccess: true,
                rules: [rule, rule],
            },
        })).rejects.toThrow('A matching network policy rule already exists.');
    });
});

function createAppPayload(projectId: string, name: string, hostname: string): AppExtendedWriteModel {
    return {
        name,
        appType: 'APP',
        projectId,
        sourceType: 'CONTAINER',
        buildMethod: 'RAILPACK',
        containerImageSource: 'nginx:latest',
        dockerfilePath: './Dockerfile',
        replicas: 1,
        envVars: '',
        ingressNetworkPolicy: 'ALLOW_ALL',
        egressNetworkPolicy: 'ALLOW_ALL',
        useNetworkPolicy: true,
        healthCheckPeriodSeconds: 15,
        healthCheckTimeoutSeconds: 5,
        healthCheckFailureThreshold: 3,
        appDomains: [{ hostname, port: 8080, useSsl: true, redirectHttps: true }],
        appNodePorts: [],
        appFileMounts: [],
        appVolumes: [],
        appBasicAuths: [],
        appNetworkPolicy: null,
    };
}
