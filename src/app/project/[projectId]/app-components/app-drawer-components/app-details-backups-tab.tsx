'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Download, Loader2, Pen, Play } from 'lucide-react';
import type { S3Target } from '@prisma/client';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { SplitButton } from '@/components/custom/split-button';
import VolumeBackupList from '@/app/project/app/[appId]/volumes/volume-backup';
import {
    downloadBackupForVolumeSchedule,
    getBackupsForVolumeSchedule,
    runBackupVolumeSchedule,
} from '@/app/project/app/[appId]/volumes/actions';
import { formatDateTime } from '@/frontend/utils/format.utils';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import { useConfirmDialog } from '@/frontend/states/zustand.states';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import type { BackupEntry } from '@/shared/model/backup-info.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import { useNestedDrawer } from './nested-drawer';

type BackupRow = BackupEntry & { schedule: VolumeBackupExtendedModel };

export function DrawerBackupsTab({ app, role, s3Targets, volumeBackups }: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    s3Targets: S3Target[];
    volumeBackups: VolumeBackupExtendedModel[];
}) {
    const { openNestedDrawer } = useNestedDrawer();
    const { openConfirmDialog } = useConfirmDialog();
    const [backups, setBackups] = useState<BackupRow[]>();
    const [hasLoadError, setHasLoadError] = useState(false);
    const [downloadingBackup, setDownloadingBackup] = useState<string>();
    const [runningSchedule, setRunningSchedule] = useState<string>();
    const readonly = role !== RolePermissionEnum.READWRITE;

    const loadBackups = useCallback(async () => {
        setBackups(undefined);
        setHasLoadError(false);
        try {
            const groups = await Promise.all(volumeBackups.map(async (schedule) => {
                const scheduleBackups = await Actions.run(() => getBackupsForVolumeSchedule(schedule.id));
                return scheduleBackups.map((backup) => ({ ...backup, schedule }));
            }));
            setBackups(
                groups.flat().sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime()),
            );
        } catch {
            setHasLoadError(true);
        }
    }, [volumeBackups]);

    useEffect(() => {
        void loadBackups();
    }, [loadBackups]);

    const scheduleLabels = useMemo(() => new Map(
        volumeBackups.map((schedule) => [schedule.id, backupType(app, schedule)]),
    ), [app, volumeBackups]);

    const showSchedules = () => openNestedDrawer({
        title: 'Backup Schedules',
        description: 'Configure backup schedules for this app.',
        content: (
            <VolumeBackupList
                app={app}
                readonly={readonly}
                s3Targets={s3Targets}
                volumeBackups={volumeBackups}
                hideCard
            />
        ),
    });

    const downloadBackup = async (backup: BackupRow) => {
        const backupId = `${backup.schedule.id}:${backup.key}`;
        try {
            setDownloadingBackup(backupId);
            const result = await Toast.fromAction(() =>
                downloadBackupForVolumeSchedule(backup.schedule.id, backup.key),
            );
            if (result.status === 'success' && result.data) {
                window.open(`/api/volume-data-download?${new URLSearchParams({ fileName: result.data }).toString()}`);
            }
        } finally {
            setDownloadingBackup(undefined);
        }
    };

    const runSchedule = async (schedule: VolumeBackupExtendedModel) => {
        const confirmed = await openConfirmDialog({
            title: 'Create Backup',
            description: `Create a ${scheduleLabels.get(schedule.id)?.toLowerCase()} now?`,
            okButton: 'Create Backup',
        });
        if (!confirmed) return;
        try {
            setRunningSchedule(schedule.id);
            await Toast.fromAction(
                () => runBackupVolumeSchedule(schedule.id),
                undefined,
                'Creating backup...',
            );
            await loadBackups();
        } finally {
            setRunningSchedule(undefined);
        }
    };

    if (volumeBackups.length === 0) {
        return <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon"><Archive /></EmptyMedia>
                <EmptyTitle>No backup schedules</EmptyTitle>
                <EmptyDescription>Create a backup schedule to protect this app&apos;s volume data.</EmptyDescription>
            </EmptyHeader>
            {!readonly && <Button onClick={showSchedules}>Edit Backup Schedules</Button>}
        </Empty>;
    }

    // ScrollArea renders its vertical scrollbar over the right edge. Reserve space
    // so the split-button trigger stays reachable instead of sitting underneath it.
    return <div className="flex min-w-0 flex-col gap-4 pr-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
            <div className="min-w-0 font-semibold text-lg text-foreground/80">Backups</div>
            {!readonly && <SplitButton
                onClick={showSchedules}
                disabled={runningSchedule !== undefined}
                containerClassName="min-w-0 max-w-full"
                variant={'outline'}
                className="h-auto min-h-9 min-w-0 shrink whitespace-normal"
                dropdownLabel="Backup schedule actions"
                dropdownContent={<DropdownMenuGroup>
                    <DropdownMenuLabel>Run backup now</DropdownMenuLabel>
                    {volumeBackups.map((schedule) => <DropdownMenuItem key={schedule.id} onClick={() => void runSchedule(schedule)}>
                        <Play /> {scheduleLabels.get(schedule.id)} · {schedule.target.name}
                    </DropdownMenuItem>)}
                </DropdownMenuGroup>}
            >
               <Pen /> Edit Backup Schedules
            </SplitButton>}
        </div>

        {hasLoadError ? <Alert variant="destructive">
            <AlertTitle>Backups could not be loaded</AlertTitle>
            <AlertDescription>Check the backup storage connection and try again.</AlertDescription>
        </Alert> : !backups ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : backups.length === 0 ? <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon"><Archive /></EmptyMedia>
                <EmptyTitle>No backups yet</EmptyTitle>
                <EmptyDescription>None of this app&apos;s backup schedules has created a backup yet.</EmptyDescription>
            </EmptyHeader>
        </Empty> : <Table className="min-w-[720px]">
            <TableHeader><TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Backup Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{backups.map((backup) => {
                const backupId = `${backup.schedule.id}:${backup.key}`;
                return <TableRow key={backupId}>
                    <TableCell>{formatDateTime(backup.backupDate, true)}</TableCell>
                    <TableCell>{backup.sizeBytes ? KubeSizeConverter.convertBytesToReadableSize(backup.sizeBytes) : 'Unknown'}</TableCell>
                    <TableCell>{backup.schedule.target.name}</TableCell>
                    <TableCell>{backupType(app, backup.schedule)}</TableCell>
                    <TableCell className="text-right"><Button type="button" variant="ghost" size="sm" onClick={() => void downloadBackup(backup)} disabled={downloadingBackup !== undefined}>
                        {downloadingBackup === backupId ? <Loader2 className="animate-spin" /> : <Download />}
                        <span className="sr-only">Download backup</span>
                    </Button></TableCell>
                </TableRow>;
            })}</TableBody>
        </Table>}
    </div>;
}

function backupType(app: AppExtendedModel, schedule: VolumeBackupExtendedModel) {
    return app.appType !== 'APP' && schedule.useDatabaseBackup
        ? `Database (${app.appType.toLowerCase()})`
        : 'Volume archive';
}
