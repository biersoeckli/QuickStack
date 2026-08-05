import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentNetworkPolicyEgressRuleEditModel, AgentNetworkPolicySettingsModel } from "@/shared/model/agent-network-policy-edit.model";

class AgentNetworkPolicyService {

    private async ensurePolicyForAgent(db: Prisma.TransactionClient, agentId: string) {
        const existingAgent = await db.agent.findFirstOrThrow({
            where: { id: agentId },
        });
        const existingPolicy = await db.agentNetworkPolicy.findUnique({
            where: { agentId },
        });
        if (existingPolicy) {
            return { policy: existingPolicy, projectId: existingAgent.projectId };
        }
        const createdPolicy = await db.agentNetworkPolicy.create({
            data: { agentId },
        });
        return { policy: createdPolicy, projectId: existingAgent.projectId };
    }

    async saveSettings(input: AgentNetworkPolicySettingsModel & { agentId: string }, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;
        let projectId: string;
        try {
            const { policy, projectId: pid } = await this.ensurePolicyForAgent(db, input.agentId);
            projectId = pid;
            await db.agentNetworkPolicy.update({
                where: { id: policy.id },
                data: { allowInternetAccess: input.allowInternetAccess },
            });
        } finally {
            if (!tx) {
                revalidateTag(Tags.agent(input.agentId));
                revalidateTag(Tags.agents(projectId!));
            }
        }
    }

    async saveEgressRule(input: AgentNetworkPolicyEgressRuleEditModel & { agentId: string }, tx?: Prisma.TransactionClient) {
        const run = async (db: Prisma.TransactionClient) => {
            let projectId: string;
            try {
                const { policy, projectId: pid } = await this.ensurePolicyForAgent(db, input.agentId);
                projectId = pid;

                const targetApp = await db.app.findFirst({ where: { id: input.targetAppId } });
                if (!targetApp) {
                    throw new ServiceException('Target app not found.');
                }

                const duplicate = await db.agentNetworkPolicyRule.findFirst({
                    where: {
                        agentNetworkPolicyId: policy.id,
                        type: 'EGRESS',
                        targetAppId: input.targetAppId,
                        port: input.port,
                        protocol: input.protocol,
                        id: input.id ? { not: input.id } : undefined,
                    },
                });
                if (duplicate) {
                    throw new ServiceException('An egress rule for this app, port and protocol already exists.');
                }

                if (input.id) {
                    const existing = await db.agentNetworkPolicyRule.findFirst({
                        where: { id: input.id, agentNetworkPolicyId: policy.id, type: 'EGRESS' },
                    });
                    if (!existing) {
                        throw new ServiceException('Egress rule not found.');
                    }
                    await db.agentNetworkPolicyRule.update({
                        where: { id: input.id },
                        data: {
                            targetAppId: input.targetAppId,
                            port: input.port,
                            protocol: input.protocol,
                        },
                    });
                } else {
                    await db.agentNetworkPolicyRule.create({
                        data: {
                            agentNetworkPolicyId: policy.id,
                            type: 'EGRESS',
                            targetAppId: input.targetAppId,
                            port: input.port,
                            protocol: input.protocol,
                        },
                    });
                }
            } finally {
                revalidateTag(Tags.agent(input.agentId));
                revalidateTag(Tags.agents(projectId!));
            }
        }
        if (tx) {
            return await run(tx);
        }
        return await dataAccess.client.$transaction(async (innerTx) => {
            return await run(innerTx);
        });
    }

    async deleteEgressRule(ruleId: string, tx?: Prisma.TransactionClient) {
        const db = tx ?? dataAccess.client;
        const rule = await db.agentNetworkPolicyRule.findUnique({
            where: { id: ruleId },
            include: { agentNetworkPolicy: { include: { agent: true } } },
        });
        if (!rule) {
            return;
        }
        try {
            await db.agentNetworkPolicyRule.delete({
                where: { id: ruleId },
            });
        } finally {
            if (!tx) {
                revalidateTag(Tags.agent(rule.agentNetworkPolicy.agentId));
                revalidateTag(Tags.agents(rule.agentNetworkPolicy.agent.projectId));
            }
        }
    }

    async getEgressRuleById(ruleId: string) {
        const rule = await dataAccess.client.agentNetworkPolicyRule.findUnique({
            where: { id: ruleId },
            include: { agentNetworkPolicy: true },
        });
        if (!rule) {
            throw new ServiceException('Egress rule not found.');
        }
        return rule;
    }
}

const agentNetworkPolicyService = new AgentNetworkPolicyService();
export default agentNetworkPolicyService;
