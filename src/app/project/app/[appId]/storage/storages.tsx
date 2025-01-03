'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, EditIcon, TrashIcon } from "lucide-react";
import DialogEditDialog from "./storage-edit-overlay";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteVolume, downloadPvcData, getPvcUsage } from "./actions";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { AppVolume } from "@prisma/client";
import React from "react";
import { KubeObjectNameUtils } from "@/server/utils/kube-object-name.utils";

type AppVolumeWithCapacity = (AppVolume & { capacity?: string });

export default function StorageList({ app }: {
    app: AppExtendedModel
}) {

    const [volumesWithStorage, setVolumesWithStorage] = React.useState<AppVolumeWithCapacity[]>(app.appVolumes);

    const loadAndMapStorageData = async () => {

        const response = (await getPvcUsage(app.id, app.projectId));

        if (response.status === 'success' && response.data) {
            const mappedVolumeData = [...app.appVolumes] as AppVolumeWithCapacity[];
            for (let item of mappedVolumeData) {
                const volume = response.data.find(x => x.pvcName === KubeObjectNameUtils.toPvcName(item.id));
                if (volume) {
                    item.capacity = `${volume.usage.toFixed(2)} MB (${(volume.usage / item.size * 100).toFixed(2)}%)`;
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
        const confirm = await openDialog({
            title: "Delete Volume",
            description: "The volume will be removed and the Data will be lost. The changes will take effect, after you deploy the app. Are you sure you want to remove this volume?",
            okButton: "Delete Volume"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteVolume(volumeId));
        }
    };

    const asyncDownloadPvcData = async (volumeId: string) => {
        const confirm = await openDialog({
            title: "Download Volume Data",
            description: "The volume data will be zipped and downloaded. Depending on the size of the volume this can take a while. Are you sure you want to download the volume data?",
            okButton: "Download"
        });
        if (confirm) {
            await Toast.fromAction(() => downloadPvcData(volumeId)).then(x => {
                if (x.status === 'success' && x.data) {
                    window.open('/api/volume-data-download?fileName=' + x.data);
                }
            });
        }
    }

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Storage</CardTitle>
                <CardDescription>Add one or more volumes to your application.</CardDescription>
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
                                <TableCell className="font-medium">{volume.capacity}</TableCell>
                                <TableCell className="font-medium">{volume.accessMode}</TableCell>
                                <TableCell className="font-medium flex gap-2">
                                    <Button variant="ghost" onClick={() => asyncDownloadPvcData(volume.id)}>
                                        <Download />
                                    </Button>
                                    <DialogEditDialog app={app} volume={volume}>
                                        <Button variant="ghost"><EditIcon /></Button>
                                    </DialogEditDialog>
                                    <Button variant="ghost" onClick={() => asyncDeleteVolume(volume.id)}>
                                        <TrashIcon />
                                    </Button>
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