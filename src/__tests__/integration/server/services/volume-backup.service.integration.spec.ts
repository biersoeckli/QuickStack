// @vitest-environment node

import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/services/deployment-logs.service', () => ({ default: {}, dlog: vi.fn() }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import dataAccess from '@/server/adapter/db.client';
import volumeBackupService from '@/server/services/volume-backup.service';
import backupService from '@/server/services/standalone-services/backup.service';
import { dlog } from '@/server/services/deployment-logs.service';
import { AppExtendedModel } from '@/shared/model/app-extended.model';

const dlogMock = dlog as unknown as ReturnType<typeof vi.fn>;

describe('volume-backup.service pre-deployment backups integration', () => {
    createPrismaTestContext('volume-backup-service-pre-deployment');

    const runBackupForSchedule = vi.fn();

    beforeEach(() => {
        runBackupForSchedule.mockReset();
        runBackupForSchedule.mockResolvedValue(undefined);
        vi.spyOn(backupService, 'runBackupForSchedule').mockImplementation(runBackupForSchedule);
        dlogMock.mockReset();
        dlogMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function createApp(projectId: string, id: string) {
        return dataAccess.client.app.create({
            data: { id, name: `app-${id}`, projectId },
        });
    }

    async function createBackup(appId: string, options: {
        createdAt: Date;
        backupBeforeDeployment: boolean;
        failSilently?: boolean;
    }) {
        const target = await dataAccess.client.s3Target.create({
            data: {
                name: `target-${appId}-${options.createdAt.getTime()}`,
                bucketName: 'bucket',
                endpoint: 'https://s3.example.com',
                region: 'eu-west-1',
                accessKeyId: 'key',
                secretKey: 'secret',
            },
        });
        const volume = await dataAccess.client.appVolume.create({
            data: { appId, containerMountPath: `/data-${options.createdAt.getTime()}`, size: 1 },
        });
        return dataAccess.client.volumeBackup.create({
            data: {
                volumeId: volume.id,
                targetId: target.id,
                cron: '0 4 * * *',
                retention: 3,
                backupBeforeDeployment: options.backupBeforeDeployment,
                failSilently: options.failSilently ?? false,
                createdAt: options.createdAt,
            },
        });
    }

    async function addRule(sourceAppId: string, targetAppId: string) {
        const policy = await dataAccess.client.appNetworkPolicy.upsert({
            where: { appId: sourceAppId },
            create: { appId: sourceAppId },
            update: {},
        });
        await dataAccess.client.appNetworkPolicyRule.create({
            data: {
                appNetworkPolicyId: policy.id,
                type: 'EGRESS',
                targetAppId,
                port: 5432,
                protocol: 'TCP',
            },
        });
    }

    it('runs opted-in backups of the app and its directly connected apps in the same project', async () => {
        const project = await dataAccess.client.project.create({ data: { name: 'P', projectType: 'APP' } });
        const app = await createApp(project.id, 'app-target');
        const connectedViaIncoming = await createApp(project.id, 'app-incoming');
        const connectedViaOutgoing = await createApp(project.id, 'app-outgoing');
        const unrelated = await createApp(project.id, 'app-unrelated');

        const base = Date.now();
        const ownBackup = await createBackup(app.id, { createdAt: new Date(base), backupBeforeDeployment: true });
        const incomingBackup = await createBackup(connectedViaIncoming.id, { createdAt: new Date(base + 1), backupBeforeDeployment: true });
        const outgoingBackup = await createBackup(connectedViaOutgoing.id, { createdAt: new Date(base + 2), backupBeforeDeployment: true });
        await createBackup(unrelated.id, { createdAt: new Date(base + 3), backupBeforeDeployment: true });
        await createBackup(app.id, { createdAt: new Date(base + 4), backupBeforeDeployment: false });

        // incoming: the peer points at the deployed app
        await addRule(connectedViaIncoming.id, app.id);
        // outgoing: the deployed app points at the peer
        await addRule(app.id, connectedViaOutgoing.id);

        await volumeBackupService.runBackupsBeforeDeployment('dep-1', {
            id: app.id,
            projectId: project.id,
        } as AppExtendedModel);

        expect(runBackupForSchedule.mock.calls.map(call => call[0]))
            .toEqual([ownBackup.id, incomingBackup.id, outgoingBackup.id]);
    });

    it('ignores connected apps from other projects', async () => {
        const project = await dataAccess.client.project.create({ data: { name: 'P', projectType: 'APP' } });
        const otherProject = await dataAccess.client.project.create({ data: { name: 'Other', projectType: 'APP' } });
        const app = await createApp(project.id, 'app-target');
        const foreignApp = await createApp(otherProject.id, 'app-foreign');

        await createBackup(foreignApp.id, { createdAt: new Date(), backupBeforeDeployment: true });
        await addRule(foreignApp.id, app.id);

        await volumeBackupService.runBackupsBeforeDeployment('dep-1', {
            id: app.id,
            projectId: project.id,
        } as AppExtendedModel);

        expect(runBackupForSchedule).not.toHaveBeenCalled();
    });

    it('aborts the deployment when a non-silent backup fails, after running the remaining backups', async () => {
        const project = await dataAccess.client.project.create({ data: { name: 'P', projectType: 'APP' } });
        const app = await createApp(project.id, 'app-target');

        const base = Date.now();
        const failing = await createBackup(app.id, { createdAt: new Date(base), backupBeforeDeployment: true, failSilently: false });
        const remaining = await createBackup(app.id, { createdAt: new Date(base + 1), backupBeforeDeployment: true, failSilently: true });

        runBackupForSchedule.mockImplementation(async (id: string) => {
            if (id === failing.id) {
                throw new Error('pod not running');
            }
        });

        await expect(volumeBackupService.runBackupsBeforeDeployment('dep-1', {
            id: app.id,
            projectId: project.id,
        } as AppExtendedModel)).rejects.toThrow('Deployment aborted');

        expect(runBackupForSchedule.mock.calls.map(call => call[0]))
            .toEqual([failing.id, remaining.id]);
    });

    it('continues the deployment when a silent backup fails', async () => {
        const project = await dataAccess.client.project.create({ data: { name: 'P', projectType: 'APP' } });
        const app = await createApp(project.id, 'app-target');

        const failing = await createBackup(app.id, { createdAt: new Date(), backupBeforeDeployment: true, failSilently: true });
        runBackupForSchedule.mockRejectedValue(new Error('boom'));

        await expect(volumeBackupService.runBackupsBeforeDeployment('dep-1', {
            id: app.id,
            projectId: project.id,
        } as AppExtendedModel)).resolves.toBeUndefined();

        expect(runBackupForSchedule).toHaveBeenCalledWith(failing.id);
    });

    it('does nothing when no schedule opted in', async () => {
        const project = await dataAccess.client.project.create({ data: { name: 'P', projectType: 'APP' } });
        const app = await createApp(project.id, 'app-target');
        await createBackup(app.id, { createdAt: new Date(), backupBeforeDeployment: false });

        await volumeBackupService.runBackupsBeforeDeployment('dep-1', {
            id: app.id,
            projectId: project.id,
        } as AppExtendedModel);

        expect(runBackupForSchedule).not.toHaveBeenCalled();
        expect(dlogMock).not.toHaveBeenCalled();
    });
});
