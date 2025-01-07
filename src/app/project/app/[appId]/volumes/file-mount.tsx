'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { deleteFileMount } from "./actions";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { AppVolume } from "@prisma/client";
import React from "react";
import FileMountEditDialog from "./file-mount-edit-dialog";

type AppVolumeWithCapacity = (AppVolume & { capacity?: string });

export default function FileMount({ app }: {
    app: AppExtendedModel
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteFileMount = async (volumeId: string) => {
        const confirm = await openDialog({
            title: "Delete File Mount",
            description: "The file mount will be removed and the Data will be lost. The changes will take effect, after you deploy the app. Are you sure you want to remove this file mount?",
            okButton: "Delete File Mount",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteFileMount(volumeId));
        }
    };

    return <>
        <Card>
            <CardHeader>
                <CardTitle>File Mount</CardTitle>
                <CardDescription>Create files wich are mounted into the container.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{app.appFileMounts.length} File Mounts</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mount Path</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {app.appFileMounts.map(fileMount => (
                            <TableRow key={fileMount.containerMountPath}>
                                <TableCell className="font-medium">{fileMount.containerMountPath}</TableCell>
                                <TableCell className="font-medium flex gap-2">
                                    <FileMountEditDialog app={app} fileMount={fileMount}>
                                        <Button variant="ghost"><EditIcon /></Button>
                                    </FileMountEditDialog>
                                    <Button variant="ghost" onClick={() => asyncDeleteFileMount(fileMount.id)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                <FileMountEditDialog app={app}>
                    <Button>Add File Mount</Button>
                </FileMountEditDialog>
            </CardFooter>
        </Card >
    </>;
}