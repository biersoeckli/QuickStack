'use client';

import { DrawerCard, DrawerCardContent, DrawerCardDescription, DrawerCardFooter, DrawerCardHeader, DrawerCardTitle } from "@/components/custom/drawer-card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import AgentVolumeEditOverlay from "./agent-volume-edit-overlay";
import { AgentVolume } from "@prisma/client";
import { AgentVolumeEditModel } from "@/shared/model/volume-edit.model";
import { deleteAgentVolume } from "./actions";

function formatSize(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
}

function volumeTypeLabel(volumeType: string): string {
    switch (volumeType) {
        case 'PER_SANDBOX':
            return 'Per Sandbox';
        case 'PER_CUSTOM_TAG':
            return 'Per Custom Tag';
        default:
            return 'All (Shared)';
    }
}

export default function AgentVolumesCard({ volumes, projectId, readonly, storageClasses }: {
    volumes: AgentVolume[];
    projectId: string;
    readonly: boolean;
    storageClasses: string[];
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
            agentId={projectId}
            storageClasses={storageClasses} />, {
            maxWidth: 'max-w-xl',
        });
    };

    return <>
        <DrawerCard>
            <DrawerCardHeader>
                <DrawerCardTitle>Volumes</DrawerCardTitle>
                <DrawerCardDescription>
                    Persistent storage volumes attached to this workload.
                </DrawerCardDescription>
            </DrawerCardHeader>
            <DrawerCardContent>
                <Table>
                    <TableCaption>{volumes.length} Volumes</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mount Path</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Access Mode</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Storage Class</TableHead>
                            {!readonly && <TableHead className="w-[100px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {volumes.map(volume => (
                            <TableRow key={volume.id} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium">{volume.containerMountPath}</TableCell>
                                <TableCell className="font-medium">{volumeTypeLabel(volume.volumeType)}</TableCell>
                                <TableCell className="font-medium">{volume.accessMode}</TableCell>
                                <TableCell className="font-medium">{formatSize(volume.size)}</TableCell>
                                <TableCell className="font-medium">{volume.storageClassName}</TableCell>
                                {!readonly && <TableCell className="w-[88px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        <Button variant="ghost" size="icon" onClick={() => openEditVolumeDialog(volume)}><EditIcon /></Button>
                                        <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => asyncDeleteVolume(volume.id)}>
                                            <TrashIcon />
                                        </Button>
                                    </div>
                                </TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DrawerCardContent>
            {!readonly && <DrawerCardFooter>
                <Button variant="outline" onClick={() => openEditVolumeDialog()}><Plus /> Add Volume</Button>
            </DrawerCardFooter>}
        </DrawerCard>
    </>;
}
