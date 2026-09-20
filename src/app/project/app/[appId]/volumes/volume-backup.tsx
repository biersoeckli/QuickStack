'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, Play, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteBackupVolume, runBackupVolumeSchedule } from "./actions";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { S3Target } from "@prisma/client";
import React from "react";
import { formatDateTime } from "@/frontend/utils/format.utils";
import VolumeBackupEditDialog from "./volume-backup-edit-overlay";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import { AppVolume } from "@prisma/client";

export default function VolumeBackupList({
    app,
    volumeBackups,
    s3Targets,
    readonly,
    hideCard = false,
}: {
    app: AppExtendedModel,
    s3Targets: S3Target[],
    volumeBackups: VolumeBackupExtendedModel[];
    readonly: boolean;
    hideCard?: boolean;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();
    const { openDialog: openGenericDialog } = useDialog();
    const [isLoading, setIsLoading] = React.useState(false);

    // Filter out shared volumes (volumes that are mounted from other apps)
    const ownVolumes = app.appVolumes.filter(volume => !volume.sharedVolumeId) as AppVolume[];

    const asyncDeleteBackupVolume = async (volumeId: string) => {
        const confirm = await openDialog({
            title: "Delete Backup Schedule",
            description: "Are you sure you want to remove this Backup Schdeule? All backups created by this schedule will still be available.",
            okButton: "Delete Backup Schedule"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteBackupVolume(volumeId));
        }
    };

    const asyncRunBackupVolumeSchedule = async (volumeId: string) => {
        const confirm = await openDialog({
            title: "Create Backup",
            description: "Are you sure you want to create a backup now?",
            okButton: "Create Backup"
        });
        setIsLoading(true);
        try {
            if (confirm) {
                await Toast.fromAction(() => runBackupVolumeSchedule(volumeId), undefined, 'Creating backup...');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const CardWrapper = hideCard ? 'div' : Card;

    return <>
        <CardWrapper>
            <CardHeader>
                <CardTitle>Backup Schedules</CardTitle>
                <CardDescription>Configure backup schedules for your volumes. Backups can be stored in a S3 bucket.</CardDescription>
            </CardHeader>
            {volumeBackups.length > 0 && <CardContent className={hideCard ? "px-0" : undefined}>
                <Table>
                    <TableCaption>{volumeBackups.length} Backup Rules</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cron Expression</TableHead>
                            <TableHead>Retention</TableHead>
                            <TableHead>Backup Method</TableHead>
                            <TableHead>Backup Location</TableHead>
                            <TableHead>Created At</TableHead>
                            {!readonly && <TableHead className="w-[120px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {volumeBackups.map(volumeBackup => (
                            <TableRow key={volumeBackup.id} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium">{volumeBackup.cron}</TableCell>
                                <TableCell className="font-medium">{volumeBackup.retention}</TableCell>
                                <TableCell className="font-medium">
                                    {app.appType !== 'APP' && volumeBackup.useDatabaseBackup
                                        ? `Database (${app.appType.toLocaleLowerCase()})`
                                        : 'Archive of Volume'}
                                </TableCell>
                                <TableCell className="font-medium">{volumeBackup.target.name}</TableCell>
                                <TableCell className="font-medium">{formatDateTime(volumeBackup.createdAt)}</TableCell>
                                {!readonly && <TableCell className="w-[120px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                    <Button disabled={isLoading} variant="ghost" size="icon" onClick={() => asyncRunBackupVolumeSchedule(volumeBackup.id)}>
                                        <Play />
                                    </Button>
                                    <Button
                                        disabled={isLoading}
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => void openGenericDialog(
                                            <VolumeBackupEditDialog
                                                volumeBackup={volumeBackup}
                                                s3Targets={s3Targets}
                                                volumes={ownVolumes}
                                                app={app}
                                            />,
                                            { maxWidth: '425px' },
                                        )}
                                    >
                                        <EditIcon />
                                    </Button>
                                    <Button disabled={isLoading} variant="ghost" size="icon" className="hover:text-destructive" onClick={() => asyncDeleteBackupVolume(volumeBackup.id)}>
                                        <TrashIcon />
                                    </Button>
                                    </div>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>}
            {!readonly && <CardFooter className={hideCard ? "px-0" : undefined}>
                <Button
                    variant="outline"
                    onClick={() => void openGenericDialog(
                        <VolumeBackupEditDialog s3Targets={s3Targets} volumes={ownVolumes} app={app} />,
                        { maxWidth: '425px' },
                    )}
                >
                    <Plus /> Add Backup Schedule
                </Button>
            </CardFooter>}
        </CardWrapper>
    </>;
}
