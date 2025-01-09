'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, EditIcon, Folder, TrashIcon } from "lucide-react";
import DialogEditDialog from "./storage-edit-overlay";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteVolume, downloadPvcData, getPvcUsage, openFileBrowserForVolume } from "./actions";
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

type AppVolumeWithCapacity = (AppVolume & { usedBytes?: number; capacityBytes?: number; usedPercentage?: number });

export default function StorageList({ app }: {
    app: AppExtendedModel
}) {

    const [volumesWithStorage, setVolumesWithStorage] = React.useState<AppVolumeWithCapacity[]>(app.appVolumes);
    const [isLoading, setIsLoading] = React.useState(false);

    const loadAndMapStorageData = async () => {

        const response = (await getPvcUsage(app.id, app.projectId));

        if (response.status === 'success' && response.data) {
            const mappedVolumeData = [...app.appVolumes] as AppVolumeWithCapacity[];
            for (let item of mappedVolumeData) {
                const volume = response.data.find(x => x.pvcName === KubeObjectNameUtils.toPvcName(item.id));
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
    }, [app.appVolumes]);

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteVolume = async (volumeId: string) => {
        try {
            const confirm = await openDialog({
                title: "Delete Volume",
                description: "The volume will be removed and the Data will be lost. The changes will take effect, after you deploy the app. Are you sure you want to remove this volume?",
                okButton: "Delete Volume"
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
                            <TableHead>Access Mode</TableHead>
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
                                <TableCell className="font-medium">{volume.accessMode}</TableCell>
                                <TableCell className="font-medium flex gap-2">
                                    <TooltipProvider>
                                        <Tooltip delayDuration={200}>
                                            <TooltipTrigger>
                                                <Button variant="ghost" onClick={() => asyncDownloadPvcData(volume.id)} disabled={isLoading}>
                                                    <Download />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Download volume content</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip delayDuration={200}>
                                            <TooltipTrigger>
                                                <Button variant="ghost" onClick={() => openFileBrowserForVolumeAsync(volume.id)} disabled={isLoading}>
                                                    <Folder />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>View content of Volume</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    {/*<StorageRestoreDialog app={app} volume={volume}>
                                        <TooltipProvider>
                                            <Tooltip delayDuration={200}>
                                                <TooltipTrigger>
                                                    <Button variant="ghost" disabled={isLoading}>
                                                        <Upload />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Restore backup from zip</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </StorageRestoreDialog>*/}
                                    <DialogEditDialog app={app} volume={volume}>
                                        <TooltipProvider>
                                            <Tooltip delayDuration={200}>
                                                <TooltipTrigger>
                                                    <Button variant="ghost" disabled={isLoading}><EditIcon /></Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Edit volume settings</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </DialogEditDialog>
                                    <TooltipProvider>
                                        <Tooltip delayDuration={200}>
                                            <TooltipTrigger>
                                                <Button variant="ghost" onClick={() => asyncDeleteVolume(volume.id)} disabled={isLoading}>
                                                    <TrashIcon />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Delete volume</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                <DialogEditDialog app={app}>
                    <Button>Add Volume</Button>
                </DialogEditDialog>
            </CardFooter>
        </Card >
    </>;
}