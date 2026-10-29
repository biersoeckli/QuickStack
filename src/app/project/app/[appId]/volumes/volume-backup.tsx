'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, List, Play, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteBackupVolume, runBackupVolumeSchedule } from "./actions";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { S3Target } from "@prisma/client";
import React from "react";
import { cn } from "@/frontend/utils/utils";
import VolumeBackupEditDialog from "./volume-backup-edit-overlay";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import { AppVolume } from "@prisma/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function VolumeBackupList({
    app,
    volumeBackups,
    s3Targets,
    readonly,
    hideCard = false,
    onBackupScheduleClick,
}: {
    app: AppExtendedModel,
    s3Targets: S3Target[],
    volumeBackups: VolumeBackupExtendedModel[];
    readonly: boolean;
    hideCard?: boolean;
    onBackupScheduleClick?: (volumeBackup: VolumeBackupExtendedModel) => void;
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
        <CardWrapper className="min-w-0">
            {!hideCard && <CardHeader>
                <CardTitle>Backup Schedules</CardTitle>
                <CardDescription>Configure backup schedules for your volumes. Backups can be stored in a S3 bucket.</CardDescription>
            </CardHeader>}
            {volumeBackups.length > 0 && <CardContent className={hideCard ? "px-0" : undefined}>
                <Table className={hideCard
                    ? "[&_th]:px-2 [&_td]:px-2"
                    : "min-w-[760px]"}>
                    <TableCaption>{volumeBackups.length} Backup Rules</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={hideCard ? "w-28 whitespace-normal" : undefined}>Cron</TableHead>
                            <TableHead className={hideCard ? "w-20 whitespace-normal" : undefined}>Retention</TableHead>
                            <TableHead className="hidden 2xl:table-cell">Backup Method</TableHead>
                            <TableHead className={cn("hidden xl:table-cell")}>Backup Location</TableHead>
                            <TableHead className={cn("hidden lg:table-cell", hideCard && "w-16 whitespace-normal")}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger render={<span>RBD</span>} />
                                        <TooltipContent>Run Before Deployment</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableHead>
                            {(onBackupScheduleClick || !readonly) && <TableHead className="w-[120px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {volumeBackups.map(volumeBackup => (
                            <TableRow key={volumeBackup.id} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className={cn("font-medium", hideCard && "whitespace-normal wrap-anywhere")}>{volumeBackup.cron}</TableCell>
                                <TableCell className="font-medium">{volumeBackup.retention}</TableCell>
                                <TableCell className="hidden font-medium 2xl:table-cell">
                                    {app.appType !== 'APP' && volumeBackup.useDatabaseBackup
                                        ? `Database (${app.appType.toLocaleLowerCase()})`
                                        : 'Archive of Volume'}
                                </TableCell>
                                <TableCell className={cn("hidden font-medium xl:table-cell", hideCard && "max-w-40 whitespace-normal wrap-anywhere")}>{volumeBackup.target.name}</TableCell>
                                <TableCell className={cn("hidden font-medium lg:table-cell", hideCard && "whitespace-normal")}>
                                    {volumeBackup.backupBeforeDeployment
                                        ? (volumeBackup.failSilently ? 'Yes (silent)' : 'Yes')
                                        : 'No'}
                                </TableCell>
                                {(onBackupScheduleClick || !readonly) && <TableCell className="w-[120px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        {onBackupScheduleClick && <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Show backups"
                                            onClick={() => onBackupScheduleClick(volumeBackup)}
                                        >
                                            <List />
                                        </Button>}
                                        {!readonly && <Button disabled={isLoading} variant="ghost" size="icon" onClick={() => {
                                            void asyncRunBackupVolumeSchedule(volumeBackup.id);
                                        }}>
                                            <Play />
                                        </Button>}
                                        {!readonly && <Button
                                            disabled={isLoading}
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                void openGenericDialog(
                                                    <VolumeBackupEditDialog
                                                        volumeBackup={volumeBackup}
                                                        s3Targets={s3Targets}
                                                        volumes={ownVolumes}
                                                        app={app}
                                                    />,
                                                    { maxWidth: '425px' },
                                                );
                                            }}
                                        >
                                            <EditIcon />
                                        </Button>}
                                        {!readonly && <Button disabled={isLoading} variant="ghost" size="icon" className="hover:text-destructive" onClick={() => {
                                            void asyncDeleteBackupVolume(volumeBackup.id);
                                        }}>
                                            <TrashIcon />
                                        </Button>}
                                    </div>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>}
            {!readonly && <CardFooter className={hideCard ? "px-0 pt-4" : undefined}>
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
