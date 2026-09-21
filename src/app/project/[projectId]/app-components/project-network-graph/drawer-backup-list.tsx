'use client';

import { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/frontend/utils/format.utils';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import type { BackupEntry } from '@/shared/model/backup-info.model';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import { getBackupsForVolumeSchedule } from '@/app/project/app/[appId]/volumes/actions';

export function DrawerBackupList({
    volumeBackup,
}: {
    volumeBackup: VolumeBackupExtendedModel;
}) {
    const [backups, setBackups] = useState<BackupEntry[]>();
    const [hasLoadError, setHasLoadError] = useState(false);

    useEffect(() => {
        setBackups(undefined);
        setHasLoadError(false);
        void Actions.run(() => getBackupsForVolumeSchedule(volumeBackup.id))
            .then(setBackups)
            .catch(() => setHasLoadError(true));
    }, [volumeBackup.id]);

    if (hasLoadError) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Backups could not be loaded</AlertTitle>
                <AlertDescription>
                    Check the backup storage connection and try again.
                </AlertDescription>
            </Alert>
        );
    }

    if (!backups) {
        return (
            <div className="flex justify-center py-12">
                <LoadingSpinner />
            </div>
        );
    }

    if (backups.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Archive />
                    </EmptyMedia>
                    <EmptyTitle>No backups yet</EmptyTitle>
                    <EmptyDescription>
                        This backup schedule has not created any backups yet.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Size</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {backups.map((backup) => (
                    <TableRow key={backup.key}>
                        <TableCell>{formatDateTime(backup.backupDate, true)}</TableCell>
                        <TableCell>
                            {backup.sizeBytes
                                ? KubeSizeConverter.convertBytesToReadableSize(backup.sizeBytes)
                                : 'Unknown'}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
