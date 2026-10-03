'use client';

import { useEffect, useState } from 'react';
import { Archive, Download, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/frontend/utils/format.utils';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import { KubeSizeConverter } from '@/shared/utils/kubernetes-size-converter.utils';
import type { BackupEntry } from '@/shared/model/backup-info.model';
import type { VolumeBackupExtendedModel } from '@/shared/model/volume-backup-extended.model';
import {
    downloadBackupForVolumeSchedule,
    getBackupsForVolumeSchedule,
} from '@/app/project/app/[appId]/volumes/actions';

export function DrawerBackupList({
    volumeBackup,
}: {
    volumeBackup: VolumeBackupExtendedModel;
}) {
    const [backups, setBackups] = useState<BackupEntry[]>();
    const [hasLoadError, setHasLoadError] = useState(false);
    const [downloadingBackupKey, setDownloadingBackupKey] = useState<string>();

    useEffect(() => {
        setBackups(undefined);
        setHasLoadError(false);
        void Actions.run(() => getBackupsForVolumeSchedule(volumeBackup.id))
            .then(setBackups)
            .catch(() => setHasLoadError(true));
    }, [volumeBackup.id]);

    const downloadBackup = async (backupKey: string) => {
        try {
            setDownloadingBackupKey(backupKey);
            const result = await Toast.fromAction(() =>
                downloadBackupForVolumeSchedule(volumeBackup.id, backupKey),
            );
            if (result.status === 'success' && result.data) {
                const params = new URLSearchParams({ fileName: result.data });
                window.open(`/api/volume-data-download?${params.toString()}`);
            }
        } finally {
            setDownloadingBackupKey(undefined);
        }
    };

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
                    <TableHead><span className="sr-only">Actions</span></TableHead>
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
                        <TableCell className="text-right">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void downloadBackup(backup.key)}
                                disabled={downloadingBackupKey !== undefined}
                            >
                                {downloadingBackupKey === backup.key ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <Download />
                                )}
                                <span className="sr-only">Download backup</span>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
