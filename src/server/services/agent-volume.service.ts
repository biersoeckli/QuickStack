import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentVolumeEditModel } from "@/shared/model/volume-edit.model";
import agentService from "./agent.service";
import { Prisma } from "@prisma/client";

class AgentVolumeService {

    async saveVolume(input: AgentVolumeEditModel & { agentId: string; id?: string }) {
        const existingAgent = await agentService.getById(input.agentId);

        try {
            if (input.id) {
                const existing = await dataAccess.client.agentVolume.findFirst({
                    where: { id: input.id, agentId: input.agentId },
                });
                if (!existing) {
                    throw new ServiceException('Agent volume not found.');
                }
                await dataAccess.client.agentVolume.update({
                    where: { id: input.id },
                    data: input as Prisma.AgentVolumeUpdateInput,
                });
            } else {
                const { id: _, ...createData } = input;
                await dataAccess.client.agentVolume.create({
                    data: createData,
                });
            }
        } finally {
            revalidateTag(Tags.agent(input.agentId));
            revalidateTag(Tags.agents(existingAgent.projectId));
        }
    }

    async deleteVolume(volumeId: string) {
        const volume = await dataAccess.client.agentVolume.findUnique({
            where: { id: volumeId },
            include: { agent: true },
        });
        if (!volume) {
            return;
        }
        try {
            await dataAccess.client.agentVolume.delete({
                where: { id: volumeId },
            });
        } finally {
            revalidateTag(Tags.agent(volume.agentId));
            revalidateTag(Tags.agents(volume.agent.projectId));
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
