'use client';

import type { S3Target } from '@prisma/client';
import VolumeBackupList from '@/app/project/app/[appId]/volumes/volume-backup';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import { useNestedDrawer } from './nested-drawer';
import { DrawerBackupList } from './drawer-backup-list';

export function DrawerBackupsTab({
    app,
    role,
    s3Targets,
    volumeBackups,
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    s3Targets: S3Target[];
    volumeBackups: VolumeBackupExtendedModel[];
}) {
    const { openNestedDrawer } = useNestedDrawer();

    return (
        <VolumeBackupList
            app={app}
            readonly={role !== RolePermissionEnum.READWRITE}
            s3Targets={s3Targets}
            volumeBackups={volumeBackups}
            hideCard
            onBackupScheduleClick={(volumeBackup) =>
                openNestedDrawer({
                    title: 'Backups',
                    description: `Backups for the ${volumeBackup.cron} schedule.`,
                    content: <DrawerBackupList volumeBackup={volumeBackup} />,
                })
            }
        />
    );
}
