'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { FileMountEditModel } from "@/shared/model/file-mount-edit.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import FileMountEditOverlay from "@/components/custom/file-mount-edit-overlay";
import { deleteFileMount } from "@/app/project/actions";

export default function FileMountsCard({ fileMounts, workloadId, workloadType, readonly }: {
    fileMounts: FileMountEditModel[];
    workloadId: string;
    workloadType: WorkloadType;
    readonly: boolean;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();

    const asyncDeleteFileMount = async (fileMountId: string) => {
        const confirm = await openConfirmDialog({
            title: "Delete File Mount",
            description: "The file mount will be removed and the data will be lost. The changes will take effect after you deploy the workload. Are you sure you want to remove this file mount?",
            okButton: "Delete File Mount",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteFileMount(fileMountId, workloadType));
        }
    };

    const openEditFileMountDialog = async (fileMount?: FileMountEditModel) => {
        await openDialog(<FileMountEditOverlay
            existingFileMount={fileMount}
            workloadId={workloadId}
            workloadType={workloadType} />, {
            maxWidth: 'max-w-2xl',
        });
    };

    return <>
        <Card>
            <CardHeader>
                <CardTitle>File Mounts</CardTitle>
                <CardDescription>Create files which are mounted into the container.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{fileMounts.length} File Mounts</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mount Path</TableHead>
                            {!readonly && <TableHead className="w-[100px]">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fileMounts.map(fileMount => (
                            <TableRow key={fileMount.id ?? fileMount.containerMountPath}>
                                <TableCell className="font-medium">{fileMount.containerMountPath}</TableCell>
                                {!readonly && <TableCell className="font-medium flex gap-2">
                                    <Button variant="ghost" onClick={() => openEditFileMountDialog(fileMount)}><EditIcon /></Button>
                                    <Button variant="ghost" onClick={() => asyncDeleteFileMount(fileMount.id!)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter>
                <Button onClick={() => openEditFileMountDialog()}><Plus /> Add File Mount</Button>
            </CardFooter>}
        </Card>
    </>;
}
