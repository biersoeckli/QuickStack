'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, EditIcon, Folder, TrashIcon, Share2, Unlink, ArrowRightLeft, MoreHorizontal, ScrollText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MigrationLogsStreamed from "@/components/custom/migration-logs-streamed";
import DialogEditDialog from "./storage-edit-overlay";
import SharedStorageEditDialog from "./shared-storage-edit-overlay";
import StorageMigrationDialog from "./storage-migration-overlay";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteVolume, downloadPvcData, getPvcUsage, getVolumeMigrationStatus, openFileBrowserForVolume } from "./actions";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { AppVolume } from "@prisma/client";
import React from "react";
import { KubeObjectNameUtils } from "@/server/utils/kube-object-name.utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Code } from "@/components/custom/code";
import { Label } from "@/components/ui/label";
import { KubeSizeConverter } from "@/shared/utils/kubernetes-size-converter.utils";
import { Progress } from "@/components/ui/progress";
import { NodeInfoModel } from "@/shared/model/node-info.model";
import { StorageClassInfoModel } from "@/shared/model/storage-class-info.model";
import { MigrationStatusResult } from "@/server/services/pvc-migration.service";

type AppVolumeWithCapacity = (AppVolume & {
    usedBytes?: number;
    capacityBytes?: number;
    usedPercentage?: number;
});

export default function StorageList({ app, readonly, nodesInfo, storageClasses }: {
    app: AppExtendedModel;
    nodesInfo: NodeInfoModel[];
    storageClasses: StorageClassInfoModel[];
    readonly: boolean;
}) {

    const [volumesWithStorage, setVolumesWithStorage] = React.useState<AppVolumeWithCapacity[]>(app.appVolumes as AppVolumeWithCapacity[]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [migrationStatuses, setMigrationStatuses] = React.useState<Record<string, MigrationStatusResult>>({});
    const [activeMigrationVolumeId, setActiveMigrationVolumeId] = React.useState<string | null>(null);
    const [activeLogsVolumeId, setActiveLogsVolumeId] = React.useState<string | null>(null);

    // Build a default not-found status for a volume
    const defaultMigrationStatus = (volumeId: string): MigrationStatusResult => ({
        status: 'not-found',
        jobName: KubeObjectNameUtils.toMigrationJobName(volumeId),
        namespace: app.projectId,
    });

    // Poll migration status for all base volumes every 10s
    React.useEffect(() => {
        const baseVolumes = app.appVolumes.filter(v => !v.sharedVolumeId);
        if (baseVolumes.length === 0) return;

        const poll = async () => {
            const results = await Promise.all(
                baseVolumes.map(async (v) => {
                    const res = await getVolumeMigrationStatus(v.id);
                    return { id: v.id, result: res.status === 'success' && res.data ? res.data : defaultMigrationStatus(v.id) };
                })
            );
            setMigrationStatuses(Object.fromEntries(results.map(r => [r.id, r.result])));
        };

        poll();
        const interval = setInterval(poll, 10_000);
        return () => clearInterval(interval);
    }, [app.appVolumes, app]);

    const loadAndMapStorageData = async () => {

        const response = (await getPvcUsage(app.id, app.projectId));

        if (response.status === 'success' && response.data) {
            const mappedVolumeData = [...app.appVolumes] as AppVolumeWithCapacity[];
            for (let item of mappedVolumeData) {
                const volume = response.data.find(x => x.pvcName === KubeObjectNameUtils.toPvcName(item.sharedVolumeId || item.id));
                if (volume) {
                    item.usedBytes = volume.usedBytes;
                    item.capacityBytes = KubeSizeConverter.fromMegabytesToBytes(item.size);
                    item.usedPercentage = Math.round(volume.usedBytes / item.capacityBytes * 100);
                }
            }
            setVolumesWithStorage(mappedVolumeData);
        } else {
            console.error(response);
        }
    }

    React.useEffect(() => {
        loadAndMapStorageData();
    }, [app.appVolumes, app]);

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteVolume = async (volumeId: string, isBaseVolume: boolean) => {
        try {
            const confirm = await openDialog({
                title: isBaseVolume ? "Delete Volume" : "Detach Volume",
                description: isBaseVolume ? "The volume will be removed and the Data will be lost. The changes will take effect, after you deploy the app. Are you sure you want to remove this volume?" :
                    "The volume will be detached from the app. The data will remain on the cluster and can be re-attached later. The changes will take effect, after you deploy the app. Are you sure you want to detach this volume?",
                okButton: isBaseVolume ? "Delete Volume" : "Detach Volume"
            });
            if (confirm) {
                setIsLoading(true);
                await Toast.fromAction(() => deleteVolume(volumeId));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const asyncDownloadPvcData = async (volumeId: string) => {
        try {
            const confirm = await openDialog({
                title: "Download Volume Data",
                description: "The volume data will be zipped and downloaded. Depending on the size of the volume this can take a while. Are you sure you want to download the volume data?",
                okButton: "Download"
            });
            if (confirm) {
                setIsLoading(true);
                await Toast.fromAction(() => downloadPvcData(volumeId)).then(x => {
                    if (x.status === 'success' && x.data) {
                        window.open('/api/volume-data-download?fileName=' + x.data);
                    }
                });
            }
        } finally {
            setIsLoading(false);
        }
    }

    const openFileBrowserForVolumeAsync = async (volumeId: string) => {

        try {
            const confirm = await openDialog({
                title: "Open File Browser",
                description: "To view the Files of the volume, your app has to be stopped. The file browser will be opened in a new tab. Are you sure you want to open the file browser?",
                okButton: "Stop App and Open File Browser"
            });
            if (!confirm) {
                return;
            }
            setIsLoading(true);
            const fileBrowserStartResult = await Toast.fromAction(() => openFileBrowserForVolume(volumeId), undefined, 'Starting file browser...')
            if (fileBrowserStartResult.status !== 'success' || !fileBrowserStartResult.data) {
                return;
            }
            await openDialog({
                title: "File Browser Ready",
                description: <>
                    The File Browser is ready and can be opened in a new tab. <br />
                    Use the following credentials to login:
                    <div className="pt-3 grid grid-cols-1 gap-1">
                        <Label>Username</Label>
                        <div> <Code>quickstack</Code></div>
                    </div>
                    <div className="pt-3 pb-4 grid grid-cols-1 gap-1">
                        <Label>Password</Label>
                        <div><Code>{fileBrowserStartResult.data.password}</Code></div>
                    </div>
                    <div>
                        <Button variant='outline' onClick={() => window.open(fileBrowserStartResult.data!.url, '_blank')}>Open File Browser</Button>
                    </div>
                </>,
                okButton: '',
                cancelButton: "Close"
            });
        } finally {
            setIsLoading(false);
        }
    }

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Volumes</CardTitle>
                <CardDescription>Add one or more volumes to to configure persistent storage within your container.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{app.appVolumes.length} Storage</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mount Path</TableHead>
                            <TableHead>Storage Size</TableHead>
                            <TableHead>Storage Used</TableHead>
                            <TableHead>Storage Class</TableHead>
                            <TableHead>Access Mode</TableHead>
                            <TableHead>Shared</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {volumesWithStorage.map(volume => (
                            <TableRow key={volume.containerMountPath}>
                                <TableCell className="font-medium">{volume.containerMountPath}</TableCell>
                                <TableCell className="font-medium">{volume.size} MB</TableCell>
                                <TableCell className="font-medium space-y-2">
                                    {volume.usedPercentage && <>
                                        <Progress value={volume.usedPercentage}
                                            color={volume.usedPercentage >= 90 ? 'red' : (volume.usedPercentage >= 80 ? 'orange' : undefined)} />
                                        <div className='text-xs text-slate-500'>
                                            {KubeSizeConverter.convertBytesToReadableSize(volume.usedBytes!)} used ({volume.usedPercentage}%)
                                        </div>
                                    </>}
                                </TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col gap-1">
                                        <span className="capitalize">{volume.storageClassName?.replace('-', ' ')}</span>
                                        {!volume.sharedVolumeId && migrationStatuses[volume.id]?.status === 'active' && (
                                            <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 inline-flex items-center gap-1 animate-pulse">
                                                <ArrowRightLeft className="h-3 w-3" />Migrating...
                                            </span>
                                        )}
                                        {!volume.sharedVolumeId && migrationStatuses[volume.id]?.status === 'succeeded' && (
                                            <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 inline-flex items-center gap-1">
                                                <ArrowRightLeft className="h-3 w-3" />Migration Done
                                            </span>
                                        )}
                                        {!volume.sharedVolumeId && migrationStatuses[volume.id]?.status === 'failed' && (
                                            <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 inline-flex items-center gap-1">
                                                <ArrowRightLeft className="h-3 w-3" />Migration Failed
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{volume.accessMode}</TableCell>
                                <TableCell className="font-medium">
                                    {volume.shareWithOtherApps && (
                                        <TooltipProvider>
                                            <Tooltip delayDuration={200}>
                                                <TooltipTrigger>
                                                    <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-800 inline-flex items-center gap-1">
                                                        <Share2 className="h-3 w-3" />
                                                        Shareable
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>This volume can be mounted by other apps in this project</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                    {volume.sharedVolumeId && (
                                        <TooltipProvider>
                                            <Tooltip delayDuration={200}>
                                                <TooltipTrigger>
                                                    <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                                                        <Share2 className="h-3 w-3" />
                                                        Shared
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>This volume is mounted from another app's volume</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex gap-1 items-center">
                                        {/* Edit — direct icon */}
                                        {!readonly && (
                                            volume.sharedVolumeId ? (
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={200}>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" disabled={true}><EditIcon className="h-4 w-4" /></Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Shared volumes cannot be edited (size and storage class are inherited)</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : (
                                                <DialogEditDialog app={app} volume={volume} nodesInfo={nodesInfo} storageClasses={storageClasses}>
                                                    <TooltipProvider>
                                                        <Tooltip delayDuration={200}>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" disabled={isLoading}><EditIcon className="h-4 w-4" /></Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Edit volume settings</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </DialogEditDialog>
                                            )
                                        )}
                                        {/* Delete / Detach — direct icon */}
                                        {!readonly && (
                                            <TooltipProvider>
                                                <Tooltip delayDuration={200}>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => asyncDeleteVolume(volume.id, !volume.sharedVolumeId)} disabled={isLoading}>
                                                            {volume.sharedVolumeId ? <Unlink className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{volume.sharedVolumeId ? 'Detach Volume' : 'Delete Volume'}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {/* More actions dropdown (base volumes only) */}
                                        {!volume.sharedVolumeId && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => asyncDownloadPvcData(volume.id)} disabled={isLoading}>
                                                        <Download className="h-4 w-4 mr-2" />Download
                                                    </DropdownMenuItem>
                                                    {!readonly && (
                                                        <DropdownMenuItem onClick={() => openFileBrowserForVolumeAsync(volume.id)} disabled={isLoading}>
                                                            <Folder className="h-4 w-4 mr-2" />Browse Files
                                                        </DropdownMenuItem>
                                                    )}
                                                    {((!readonly && storageClasses.length > 1) || (migrationStatuses[volume.id] && migrationStatuses[volume.id].status !== 'not-found')) && (
                                                        <DropdownMenuSeparator />
                                                    )}
                                                    {!readonly && storageClasses.length > 1 && (
                                                        <DropdownMenuItem
                                                            onClick={() => setActiveMigrationVolumeId(volume.id)}
                                                            disabled={isLoading || migrationStatuses[volume.id]?.status === 'active'}
                                                        >
                                                            <ArrowRightLeft className="h-4 w-4 mr-2" />Migrate Storage Class
                                                        </DropdownMenuItem>
                                                    )}
                                                    {migrationStatuses[volume.id]?.status && migrationStatuses[volume.id].status !== 'not-found' && (
                                                        <DropdownMenuItem onClick={() => setActiveLogsVolumeId(volume.id)}>
                                                            <ScrollText className="h-4 w-4 mr-2" />View Migration Logs
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter className="flex gap-2">
                <DialogEditDialog app={app} nodesInfo={nodesInfo} storageClasses={storageClasses}>
                    <Button>Add Volume</Button>
                </DialogEditDialog>
                <SharedStorageEditDialog app={app}>
                    <Button variant="outline">Add Shared Volume</Button>
                </SharedStorageEditDialog>
            </CardFooter>}
        </Card >

        {/* Controlled migration dialog */}
        {activeMigrationVolumeId && (() => {
            const activeVolume = volumesWithStorage.find(v => v.id === activeMigrationVolumeId);
            if (!activeVolume) return null;
            return (
                <StorageMigrationDialog
                    open={true}
                    onOpenChange={(o) => { if (!o) setActiveMigrationVolumeId(null); }}
                    volume={activeVolume}
                    app={app}
                    storageClasses={storageClasses}
                    nodesInfo={nodesInfo}
                    migrationStatus={migrationStatuses[activeMigrationVolumeId] ?? defaultMigrationStatus(activeMigrationVolumeId)}
                />
            );
        })()}

        {/* Controlled migration logs dialog */}
        {activeLogsVolumeId && (() => {
            const activeVolume = volumesWithStorage.find(v => v.id === activeLogsVolumeId);
            if (!activeVolume) return null;
            const status = migrationStatuses[activeLogsVolumeId] ?? defaultMigrationStatus(activeLogsVolumeId);
            return (
                <Dialog open={true} onOpenChange={(o) => { if (!o) setActiveLogsVolumeId(null); }}>
                    <DialogContent className="sm:max-w-[700px]">
                        <DialogHeader>
                            <DialogTitle>Migration Logs — {activeVolume.containerMountPath}</DialogTitle>
                            <DialogDescription>
                                Live rsync output from the migration job.
                            </DialogDescription>
                        </DialogHeader>
                        <MigrationLogsStreamed
                            migrationJobName={status.jobName}
                            migrationJobNamespace={status.namespace}
                        />
                    </DialogContent>
                </Dialog>
            );
        })()}
    </>;
}