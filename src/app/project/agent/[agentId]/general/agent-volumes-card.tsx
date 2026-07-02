'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import AgentVolumeEditOverlay from "@/app/project/agent/[agentId]/general/agent-volume-edit-overlay";
import { AgentVolume } from "@prisma/client";
import { AgentVolumeEditModel } from "@/shared/model/volume-edit.model";
import { deleteAgentVolume } from "./actions";

function formatSize(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
}

export default function AgentVolumesCard({ volumes, projectId, readonly }: {
    volumes: AgentVolume[];
    projectId: string;
    readonly: boolean;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();

    const asyncDeleteVolume = async (volumeId: string) => {
        const confirm = await openConfirmDialog({
            title: "Delete Volume",
            description: "The volume will be removed permanently. Are you sure you want to delete this volume?",
            okButton: "Delete Volume"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteAgentVolume(volumeId));
        }
    };

    const openEditVolumeDialog = async (volume?: AgentVolume) => {
        await openDialog(<AgentVolumeEditOverlay
            existingVolume={volume as AgentVolumeEditModel & { storageClassName: string }}
            agentId={projectId} />, {
            maxWidth: 'max-w-xl',
        });
    };

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Volumes</CardTitle>
                <CardDescription>
                    Persistent storage volumes attached to this workload.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{volumes.length} Volumes</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mount Path</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Storage Class</TableHead>
                            {!readonly && <TableHead className="w-[100px]">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {volumes.map(volume => (
                            <TableRow key={volume.id}>
                                <TableCell className="font-medium">{volume.containerMountPath}</TableCell>
                                <TableCell className="font-medium">{formatSize(volume.size)}</TableCell>
                                <TableCell className="font-medium">{volume.storageClassName}</TableCell>
                                {!readonly && <TableCell className="font-medium flex gap-2">
                                    <Button variant="ghost" onClick={() => openEditVolumeDialog(volume)}><EditIcon /></Button>
                                    <Button variant="ghost" onClick={() => asyncDeleteVolume(volume.id)}>
                                        <TrashIcon />
                                    </Button>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter>
                <Button onClick={() => openEditVolumeDialog()}><Plus /> Add Volume</Button>
            </CardFooter>}
        </Card>
    </>;
}
