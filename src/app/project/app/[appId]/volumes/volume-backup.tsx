'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteBackupVolume, deleteVolume } from "./actions";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { S3Target, VolumeBackup } from "@prisma/client";
import React from "react";
import { formatDateTime } from "@/frontend/utils/format.utils";
import VolumeBackupEditDialog from "./volume-backup-edit-overlay";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";

export default function VolumeBackupList({
    app,
    volumeBackups,
    s3Targets
}: {
    app: AppExtendedModel,
    s3Targets: S3Target[],
    volumeBackups: VolumeBackupExtendedModel[]
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

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
                                <TableCell className="font-medium">{volumeBackup.target.name}</TableCell>
                                <TableCell className="font-medium">{formatDateTime(volumeBackup.createdAt)}</TableCell>
                                <TableCell className="font-medium flex gap-2">
                                    <VolumeBackupEditDialog volumeBackup={volumeBackup}
                                        s3Targets={s3Targets} volumes={app.appVolumes}>
                                        <Button variant="ghost"><EditIcon /></Button>
                                    </VolumeBackupEditDialog>
                                    <Button variant="ghost" onClick={() => asyncDeleteBackupVolume(volumeBackup.id)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                <VolumeBackupEditDialog s3Targets={s3Targets} volumes={app.appVolumes}>
                    <Button>Add Backup Schedule</Button>
                </VolumeBackupEditDialog>
            </CardFooter>
        </Card >
    </>;
}