import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentVolumeEditModel } from "@/shared/model/volume-edit.model";
import { Prisma } from "@prisma/client";

class AgentVolumeService {

    async saveVolume(input: AgentVolumeEditModel & { agentId: string; id?: string }, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;

        const existingAgent = await db.agent.findFirstOrThrow({
            where: { id: input.agentId },
        });

        try {
            if (input.id) {
                const existing = await db.agentVolume.findFirst({
                    where: { id: input.id, agentId: input.agentId },
                });
                if (!existing) {
                    throw new ServiceException('Agent volume not found.');
                }
                if (existing.storageClassName !== input.storageClassName) {
                    throw new ServiceException('Storage class cannot be changed for existing volumes');
                }
                const updateData = { ...input };
                delete updateData.id;
                await db.agentVolume.update({
                    where: { id: input.id },
                    data: updateData as Prisma.AgentVolumeUpdateInput,
                });
            } else {
                const createData = { ...input };
                delete createData.id;
                await db.agentVolume.create({
                    data: createData,
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
