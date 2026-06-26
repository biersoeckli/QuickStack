import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { FileMountEditModel } from "@/shared/model/file-mount-edit.model";
import agentService from "./agent.service";
import { Prisma } from "@prisma/client";

class AgentFileMountService {

    async getById(fileMountId: string) {
        return await dataAccess.client.agentFileMount.findFirstOrThrow({
            where: {
                id: fileMountId
            }
        });
    }

    async saveFileMount(input: FileMountEditModel & { agentId: string }) {
        const existingAgent = await agentService.getById(input.agentId);

        try {
            if (input.id) {
                const existing = await dataAccess.client.agentFileMount.findFirst({
                    where: { id: input.id, agentId: input.agentId },
                });
                if (!existing) {
                    throw new ServiceException('Agent file mount not found.');
                }
                await dataAccess.client.agentFileMount.update({
                    where: { id: input.id },
                    data: input as Prisma.AgentFileMountUncheckedUpdateInput,
                });
            } else {
                const { id: _id, ...data } = input;
                await dataAccess.client.agentFileMount.create({
                    data,
                });
            }
        } finally {
            revalidateTag(Tags.agent(input.agentId));
            revalidateTag(Tags.agents(existingAgent.projectId));
        }
    }

    async deleteFileMount(fileMountId: string) {
        const fileMount = await dataAccess.client.agentFileMount.findUnique({
            where: { id: fileMountId },
            include: { agent: true },
        });
        if (!fileMount) {
            return;
        }
        try {
            await dataAccess.client.agentFileMount.delete({
                where: { id: fileMountId },
            });
        } finally {
            revalidateTag(Tags.agent(fileMount.agentId));
            revalidateTag(Tags.agents(fileMount.agent.projectId));
        }
    }
}

const agentFileMountService = new AgentFileMountService();
export default agentFileMountService;
