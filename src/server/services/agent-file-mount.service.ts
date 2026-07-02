import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { FileMountEditModel } from "@/shared/model/file-mount-edit.model";
import { Prisma } from "@prisma/client";

class AgentFileMountService {

    async getFileMountById(fileMountId: string) {
        return await dataAccess.client.agentFileMount.findFirstOrThrow({
            where: {
                id: fileMountId
            }
        });
    }

    async saveFileMount(input: FileMountEditModel & { agentId: string }, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;

        const existingAgent = await db.agent.findFirstOrThrow({
            where: { id: input.agentId },
        });

        try {
            if (input.id) {
                const existing = await db.agentFileMount.findFirst({
                    where: { id: input.id, agentId: input.agentId },
                });
                if (!existing) {
                    throw new ServiceException('Agent file mount not found.');
                }
                await db.agentFileMount.update({
                    where: { id: input.id },
                    data: input as Prisma.AgentFileMountUncheckedUpdateInput,
                });
            } else {
                const { id: _id, ...data } = input;
                await db.agentFileMount.create({
                    data,
                });
            }
        } finally {
            if (!tx) {
                revalidateTag(Tags.agent(input.agentId));
                revalidateTag(Tags.agents(existingAgent.projectId));
            }
        }
    }

    async deleteFileMount(fileMountId: string, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;
        const fileMount = await db.agentFileMount.findUnique({
            where: { id: fileMountId },
            include: { agent: true },
        });
        if (!fileMount) {
            return;
        }
        try {
            await db.agentFileMount.delete({
                where: { id: fileMountId },
            });
        } finally {
            if (!tx) {
                revalidateTag(Tags.agent(fileMount.agentId));
                revalidateTag(Tags.agents(fileMount.agent.projectId));
            }
        }
    }
}

const agentFileMountService = new AgentFileMountService();
export default agentFileMountService;
