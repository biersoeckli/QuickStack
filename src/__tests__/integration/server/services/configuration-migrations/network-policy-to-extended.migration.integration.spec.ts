// @vitest-environment node

vi.mock('@/server/services/configuration-migrations/network-policy-to-extended.derivation', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/server/services/configuration-migrations/network-policy-to-extended.derivation')>();
    return {
        ...actual,
        deriveExtendedConfiguration: vi.fn(actual.deriveExtendedConfiguration),
    };
});

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import dataAccess from '@/server/adapter/db.client';
import networkPolicyToExtendedMigration from '@/server/services/configuration-migrations/network-policy-migration/network-policy-to-extended.migration';
import { deriveExtendedConfiguration } from '@/server/services/configuration-migrations/network-policy-to-extended.derivation';

describe('network-policy-to-extended migration', () => {
    createPrismaTestContext('network-policy-to-extended-migration');

    async function createProject(id: string) {
        return dataAccess.client.project.create({
            data: { id, name: id, projectType: 'APP' },
        });
    }

    async function createApp(projectId: string, overrides: {
        id: string;
        appType?: string;
        ingressNetworkPolicy?: string;
        egressNetworkPolicy?: string;
        useNetworkPolicy?: boolean;
        networkPolicyMode?: string;
    } & { ports?: number[] }) {
        const app = await dataAccess.client.app.create({
            data: {
                id: overrides.id,
                name: overrides.id,
                projectId,
                appType: overrides.appType ?? 'APP',
                ingressNetworkPolicy: overrides.ingressNetworkPolicy ?? 'ALLOW_ALL',
                egressNetworkPolicy: overrides.egressNetworkPolicy ?? 'ALLOW_ALL',
                useNetworkPolicy: overrides.useNetworkPolicy ?? true,
                networkPolicyMode: overrides.networkPolicyMode ?? 'SIMPLE',
            },
        });
        for (const port of overrides.ports ?? []) {
            await dataAccess.client.appPort.create({
                data: { appId: app.id, port },
            });
        }
        return app;
    }

    async function createPolicy(appId: string, allowInternetAccess: boolean, rules: { type: string; targetAppId: string; port: number }[]) {
        await dataAccess.client.appNetworkPolicy.create({
            data: {
                appId,
                allowInternetAccess,
                rules: { create: rules.map(rule => ({ type: rule.type, targetAppId: rule.targetAppId, port: rule.port, protocol: 'TCP' })) },
            },
        });
    }

    async     function getPolicy(appId: string) {
        return dataAccess.client.appNetworkPolicy.findUnique({
            where: { appId },
            include: { rules: true },
        });
    }

    function ruleKeys(rules: { type: string; targetAppId: string | null; port: number; protocol: string }[]) {
        return rules
            .map(rule => `${rule.type}:${rule.targetAppId}:${rule.port}:${rule.protocol}`)
            .sort();
    }

    const originalDerive = vi.mocked(deriveExtendedConfiguration).getMockImplementation()!;

    afterEach(() => {
        vi.mocked(deriveExtendedConfiguration).mockImplementation(originalDerive);
    });

    it('converts every Simple App to its Extended equivalent within its project', async () => {
        await createProject('proj-p');
        await createProject('proj-q');

        await createApp('proj-p', { id: 'app-web', ports: [80], egressNetworkPolicy: 'NAMESPACE_ONLY' });
        await createApp('proj-p', { id: 'app-db', appType: 'POSTGRES', ports: [5432], ingressNetworkPolicy: 'NAMESPACE_ONLY', egressNetworkPolicy: 'DENY_ALL' });
        await createApp('proj-p', { id: 'app-ext', networkPolicyMode: 'EXTENDED', ports: [3000] });
        await createApp('proj-p', { id: 'app-disabled', useNetworkPolicy: false, ports: [9000] });
        await createApp('proj-q', { id: 'app-x', ports: [8080] });

        await networkPolicyToExtendedMigration.runMigration();

        const migratedWeb = await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-web' } });
        expect(migratedWeb.networkPolicyMode).toBe('EXTENDED');
        const webPolicy = await getPolicy('app-web');
        expect(webPolicy?.allowInternetAccess).toBe(false);
        expect(ruleKeys(webPolicy?.rules ?? [])).toEqual([
            'EGRESS:app-db:5432:TCP',
            'EGRESS:app-disabled:9000:TCP',
            'EGRESS:app-ext:3000:TCP',
            'INGRESS:app-db:80:TCP',
            'INGRESS:app-disabled:80:TCP',
            'INGRESS:app-ext:80:TCP',
        ]);

        const migratedDb = await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-db' } });
        expect(migratedDb.networkPolicyMode).toBe('EXTENDED');
        const dbPolicy = await getPolicy('app-db');
        expect(dbPolicy?.allowInternetAccess).toBe(false);
        expect(ruleKeys(dbPolicy?.rules ?? [])).toEqual([
            'INGRESS:app-disabled:5432:TCP',
            'INGRESS:app-ext:5432:TCP',
            'INGRESS:app-web:5432:TCP',
        ]);

        const disabled = await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-disabled' } });
        expect(disabled.networkPolicyMode).toBe('EXTENDED');
        expect(await getPolicy('app-disabled')).toBeNull();

        const migratedX = await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-x' } });
        expect(migratedX.networkPolicyMode).toBe('EXTENDED');
        const xPolicy = await getPolicy('app-x');
        expect(xPolicy?.allowInternetAccess).toBe(true);
        expect(xPolicy?.rules).toEqual([]);
    });

    it('leaves Apps already in Extended mode untouched', async () => {
        await createProject('proj-p');
        await createApp('proj-p', { id: 'app-db', ports: [5432] });
        await createApp('proj-p', { id: 'app-ext', networkPolicyMode: 'EXTENDED', ports: [3000] });
        await createPolicy('app-ext', true, [{ type: 'INGRESS', targetAppId: 'app-db', port: 3000 }]);

        await networkPolicyToExtendedMigration.runMigration();

        const extApp = await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-ext' } });
        expect(extApp.networkPolicyMode).toBe('EXTENDED');
        const extPolicy = await getPolicy('app-ext');
        expect(extPolicy?.allowInternetAccess).toBe(true);
        expect(extPolicy?.rules).toHaveLength(1);
        expect(extPolicy?.rules[0]).toMatchObject({ targetAppId: 'app-db', port: 3000, type: 'INGRESS' });
    });

    it('overwrites dormant Extended configuration when migrating a Simple App', async () => {
        await createProject('proj-p');
        await createApp('proj-p', { id: 'app-web', ports: [80], egressNetworkPolicy: 'DENY_ALL', ingressNetworkPolicy: 'DENY_ALL' });
        await createApp('proj-p', { id: 'app-peer', ports: [8080] });
        await createPolicy('app-web', true, [{ type: 'INGRESS', targetAppId: 'app-peer', port: 9999 }]);

        await networkPolicyToExtendedMigration.runMigration();

        const webPolicy = await getPolicy('app-web');
        expect(webPolicy?.allowInternetAccess).toBe(false);
        expect(webPolicy?.rules).toEqual([]);
    });

    it('does not migrate twice when runMigration is called again', async () => {
        await createProject('proj-p');
        await createApp('proj-p', { id: 'app-web', ports: [80] });

        await networkPolicyToExtendedMigration.runMigration();
        const ruleCountAfterFirstRun = await dataAccess.client.appNetworkPolicyRule.count();
        const policyCountAfterFirstRun = await dataAccess.client.appNetworkPolicy.count();

        await networkPolicyToExtendedMigration.runMigration();

        expect(await dataAccess.client.appNetworkPolicyRule.count()).toBe(ruleCountAfterFirstRun);
        expect(await dataAccess.client.appNetworkPolicy.count()).toBe(policyCountAfterFirstRun);
        expect(await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-web' } }))
            .toMatchObject({ networkPolicyMode: 'EXTENDED' });
    });

    it('rolls back every App when the derivation fails', async () => {
        await createProject('proj-p');
        await createApp('proj-p', { id: 'app-a', ports: [80] });
        await createApp('proj-p', { id: 'app-b', ports: [80] });

        vi.mocked(deriveExtendedConfiguration).mockImplementation((app, peers) => {
            if (app.id === 'app-b') {
                throw new Error('derivation exploded');
            }
            return originalDerive(app, peers);
        });

        await expect(networkPolicyToExtendedMigration.runMigration()).rejects.toThrow('derivation exploded');

        expect(await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-a' } }))
            .toMatchObject({ networkPolicyMode: 'SIMPLE' });
        expect(await dataAccess.client.app.findUniqueOrThrow({ where: { id: 'app-b' } }))
            .toMatchObject({ networkPolicyMode: 'SIMPLE' });
        expect(await dataAccess.client.appNetworkPolicy.count()).toBe(0);
    });
});
