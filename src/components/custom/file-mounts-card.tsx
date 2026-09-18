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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function FileMountsCard({ fileMounts, workloadId, workloadType, readonly, hideCard = false }: {
    fileMounts: FileMountEditModel[];
    workloadId: string;
    workloadType: WorkloadType;
    readonly: boolean;
    hideCard?: boolean;
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

    const CardWrapper = hideCard ? 'div' : Card;

    return <>
        <CardWrapper>
            <CardHeader>
                <CardTitle>File Mounts</CardTitle>
                <CardDescription>Create files which are mounted into the container.</CardDescription>
            </CardHeader>
            {fileMounts.length > 0 && <CardContent className={hideCard ? "px-0" : undefined}>
                <Table>
                    <TableCaption>{fileMounts.length} File Mounts</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mount Path</TableHead>
                            {!readonly && <TableHead className="w-[100px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fileMounts.map(fileMount => (
                            <TableRow key={fileMount.id ?? fileMount.containerMountPath} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium">{fileMount.containerMountPath}</TableCell>
                                {!readonly && <TableCell className="w-[88px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        <TooltipProvider><Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => openEditFileMountDialog(fileMount)}><EditIcon /></Button>} /><TooltipContent>Edit file mount</TooltipContent></Tooltip></TooltipProvider>
                                        <TooltipProvider><Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => asyncDeleteFileMount(fileMount.id!)}><TrashIcon /></Button>} /><TooltipContent>Delete file mount</TooltipContent></Tooltip></TooltipProvider>
                                    </div>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>}
            {!readonly && <CardFooter className={hideCard ? "px-0" : undefined}>
                <Button onClick={() => openEditFileMountDialog()}><Plus /> Add File Mount</Button>
            </CardFooter>}
        </CardWrapper>
    </>;
}
