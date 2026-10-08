import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import {
    AgentVolumeAccessMode,
    AgentVolumeSaveModel,
    AgentVolumeType,
    agentVolumeEditZodModel,
} from "@/shared/model/volume-edit.model";
import { Prisma } from "@prisma/client";

class AgentVolumeService {

    private parseVolume(input: AgentVolumeSaveModel) {
        const parsed = agentVolumeEditZodModel.safeParse(input);
        if (!parsed.success) {
            throw new ServiceException('Invalid Agent Volume configuration.');
        }
        return parsed.data;
    }

    private assertAccessModeAllowed(volumeType: AgentVolumeType, accessMode: AgentVolumeAccessMode) {
        if (volumeType === 'ALL' && accessMode !== 'ReadWriteMany') {
            throw new ServiceException('Agent Volumes with Volume Type ALL require ReadWriteMany access mode.');
        }
    }

    async saveVolume(input: AgentVolumeSaveModel, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;

        const existingAgent = await db.agent.findFirstOrThrow({
            where: { id: input.agentId },
        });

        const parsed = this.parseVolume(input);

        try {
            if (input.id) {
                const existing = await db.agentVolume.findFirst({
                    where: { id: input.id, agentId: input.agentId },
                });
                if (!existing) {
                    throw new ServiceException('Agent volume not found.');
                }
                if (existing.storageClassName !== parsed.storageClassName) {
                    throw new ServiceException('Storage class cannot be changed for existing volumes');
                }

                const volumeType = (parsed.volumeType ?? existing.volumeType) as AgentVolumeType;
                const accessMode = (parsed.accessMode ?? existing.accessMode) as AgentVolumeAccessMode;
                this.assertAccessModeAllowed(volumeType, accessMode);

                if (existing.volumeType !== volumeType) {
                    throw new ServiceException('Volume type cannot be changed for existing volumes');
                }
                if (existing.accessMode !== accessMode) {
                    throw new ServiceException('Access mode cannot be changed for existing volumes');
                }
                await db.agentVolume.update({
                    where: { id: input.id },
                    data: {
                        containerMountPath: parsed.containerMountPath,
                        size: parsed.size,
                        storageClassName: parsed.storageClassName,
                        volumeType,
                        accessMode,
                    } as Prisma.AgentVolumeUpdateInput,
                });
            } else {
                const volumeType = (parsed.volumeType ?? 'ALL') as AgentVolumeType;
                const accessMode = (parsed.accessMode ?? 'ReadWriteMany') as AgentVolumeAccessMode;
                this.assertAccessModeAllowed(volumeType, accessMode);
                await db.agentVolume.create({
                    data: {
                        containerMountPath: parsed.containerMountPath,
                        size: parsed.size,
                        storageClassName: parsed.storageClassName,
                        volumeType,
                        accessMode,
                        agentId: input.agentId,
                    },
                });
            }
        } finally {
            if (!tx) {
                revalidateTag(Tags.agent(input.agentId));
                revalidateTag(Tags.agents(existingAgent.projectId));
            }
        }
    }

    async deleteVolume(volumeId: string, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;
        const volume = await db.agentVolume.findUnique({
            where: { id: volumeId },
            include: { agent: true },
        });
        if (!volume) {
            return;
        }
        try {
            await db.agentVolume.delete({
                where: { id: volumeId },
            });
        } finally {
            if (!tx) {
                revalidateTag(Tags.agent(volume.agentId));
                revalidateTag(Tags.agents(volume.agent.projectId));
            }
        }
    }

    async getVolumeById(volumeId: string) {
        const volume = await dataAccess.client.agentVolume.findUnique({
            where: { id: volumeId },
        });
        if (!volume) {
            throw new ServiceException('Agent volume not found.');
        }
        return volume;
    }

    async getVolumesForAgent(agentId: string) {
        return dataAccess.client.agentVolume.findMany({
            where: { agentId },
            orderBy: { createdAt: 'asc' },
        });
    }
}

const agentVolumeService = new AgentVolumeService();
export default agentVolumeService;
