'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, Play, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteBackupVolume, runBackupVolumeSchedule } from "./actions";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { S3Target } from "@prisma/client";
import React from "react";
import { formatDateTime } from "@/frontend/utils/format.utils";
import VolumeBackupEditDialog from "./volume-backup-edit-overlay";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";

export default function VolumeBackupList({
    app,
    volumeBackups,
    s3Targets,
    readonly
}: {
    app: AppExtendedModel,
    s3Targets: S3Target[],
    volumeBackups: VolumeBackupExtendedModel[];
    readonly: boolean;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();
    const [isLoading, setIsLoading] = React.useState(false);

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

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Backup Schedules</CardTitle>
                <CardDescription>Configure backup schedules for your volumes. Backups can be stored in a S3 bucket.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{volumeBackups.length} Backup Rules</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cron Expression</TableHead>
                            <TableHead>Retention</TableHead>
                            <TableHead>Backup Method</TableHead>
                            <TableHead>Backup Location</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {volumeBackups.map(volumeBackup => (
                            <TableRow key={volumeBackup.id}>
                                <TableCell className="font-medium">{volumeBackup.cron}</TableCell>
                                <TableCell className="font-medium">{volumeBackup.retention}</TableCell>
                                <TableCell className="font-medium">
                                    {app.appType !== 'APP' && volumeBackup.useDatabaseBackup
                                        ? `Database (${app.appType.toLocaleLowerCase()})`
                                        : 'Archive from Volume'}
                                </TableCell>
                                <TableCell className="font-medium">{volumeBackup.target.name}</TableCell>
                                <TableCell className="font-medium">{formatDateTime(volumeBackup.createdAt)}</TableCell>
                                {!readonly && <TableCell className="font-medium flex gap-2">
                                    <Button disabled={isLoading} variant="ghost" onClick={() => asyncRunBackupVolumeSchedule(volumeBackup.id)}>
                                        <Play />
                                    </Button>
                                    <VolumeBackupEditDialog volumeBackup={volumeBackup}
                                        s3Targets={s3Targets} volumes={app.appVolumes} app={app}>
                                        <Button disabled={isLoading} variant="ghost"><EditIcon /></Button>
                                    </VolumeBackupEditDialog>
                                    <Button disabled={isLoading} variant="ghost" onClick={() => asyncDeleteBackupVolume(volumeBackup.id)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter>
                <VolumeBackupEditDialog s3Targets={s3Targets} volumes={app.appVolumes} app={app}>
                    <Button>Add Backup Schedule</Button>
                </VolumeBackupEditDialog>
            </CardFooter>}
        </Card >
    </>;
}