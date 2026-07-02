import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { DomainEditModel } from "@/shared/model/domain-edit.model";
import { Prisma } from "@prisma/client";

class AgentDomainService {

    async saveDomain(input: DomainEditModel & { agentId: string }, db: Prisma.TransactionClient = dataAccess.client) {
        const existingAgent = await db.agent.findFirstOrThrow({
            where: { id: input.agentId },
        });

        const existingDomainWithSameHostname = await db.agentDomain.findUnique({
            where: { hostname: input.hostname },
        });
        if (existingDomainWithSameHostname && existingDomainWithSameHostname.agentId !== input.agentId) {
            throw new ServiceException('Domain is already assigned to another Agent.');
        }

        try {
            if (input.id) {
                const existing = await db.agentDomain.findFirst({
                    where: { id: input.id, agentId: input.agentId },
                });
                if (!existing) {
                    throw new ServiceException('Agent domain not found.');
                }
                await db.agentDomain.update({
                    where: { id: input.id },
                    data: input,
                });
            } else {
                const { id: _id, ...data } = input;
                await db.agentDomain.create({
                    data,
                });
            }
        } finally {
            revalidateTag(Tags.agent(input.agentId));
            revalidateTag(Tags.agents(existingAgent.projectId));
        }
    }

    async deleteDomain(domainId: string, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;
        const domain = await db.agentDomain.findUnique({
            where: { id: domainId },
            include: { agent: true },
        });
        if (!domain) {
            return;
        }
        try {
            await db.agentDomain.delete({
                where: { id: domainId },
            });
        } finally {
            if (!tx) {
                revalidateTag(Tags.agent(domain.agentId));
                revalidateTag(Tags.agents(domain.agent.projectId));
            }
        }
    }

    async getDomainById(domainId: string) {
        const domain = await dataAccess.client.agentDomain.findUnique({
            where: { id: domainId },
        });
        if (!domain) {
            throw new ServiceException('Agent domain not found.');
        }
        return domain;
    }

    async getDomainForAgent(agentId: string, domainId: string) {
        const domain = await dataAccess.client.agentDomain.findFirst({
            where: { id: domainId, agentId },
        });
        if (!domain) {
            throw new ServiceException('Agent access domain is not configured.');
        }
        return domain;
    }
}

const agentDomainService = new AgentDomainService();
export default agentDomainService;
