import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentNetworkPolicyEgressRuleEditModel, AgentNetworkPolicySettingsModel } from "@/shared/model/agent-network-policy-edit.model";
import { AgentExtendedWriteModel } from "@/shared/model/agent-extended.model";
import { UserSession } from "@/shared/model/sim-session.model";
import networkPolicyRuleMirrorService, { NetworkPolicyMirrorTouch } from "./network-policy-rule-mirror.service";

type AgentNetworkPolicyConfigurationWriteModel = NonNullable<AgentExtendedWriteModel['agentNetworkPolicy']>;

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

    private invalidateMirrorTouches(touches: NetworkPolicyMirrorTouch[]) {
        for (const touch of touches) {
            revalidateTag(Tags.app(touch.workloadId));
            revalidateTag(Tags.apps(touch.projectId));
        }
    }

    private invalidateCounterpartApps(apps: { id: string; projectId: string }[]) {
        for (const app of apps) {
            revalidateTag(Tags.app(app.id));
            revalidateTag(Tags.apps(app.projectId));
        }
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

    private async saveEgressRuleInTransaction(
        db: Prisma.TransactionClient,
        policyId: string,
        input: AgentNetworkPolicyEgressRuleEditModel,
    ) {
        const targetApp = await db.app.findFirst({ where: { id: input.targetAppId } });
        if (!targetApp) {
            throw new ServiceException('Target app not found.');
        }

        const duplicate = await db.agentNetworkPolicyRule.findFirst({
            where: {
                agentNetworkPolicyId: policyId,
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
                where: { id: input.id, agentNetworkPolicyId: policyId, type: 'EGRESS' },
            });
            if (!existing) {
                throw new ServiceException('Egress rule not found.');
            }
            return await db.agentNetworkPolicyRule.update({
                where: { id: input.id },
                data: {
                    targetAppId: input.targetAppId,
                    port: input.port,
                    protocol: input.protocol,
                },
            });
        }

        return await db.agentNetworkPolicyRule.create({
            data: {
                agentNetworkPolicyId: policyId,
                type: 'EGRESS',
                targetAppId: input.targetAppId,
                port: input.port,
                protocol: input.protocol,
            },
        });
    }

    private async replaceEgressRules(
        db: Prisma.TransactionClient,
        policyId: string,
        rules: AgentNetworkPolicyEgressRuleEditModel[],
    ) {
        await db.agentNetworkPolicyRule.deleteMany({
            where: {
                agentNetworkPolicyId: policyId,
                id: { notIn: rules.flatMap(rule => rule.id ? [rule.id] : []) },
            },
        });
        for (const rule of rules) {
            await this.saveEgressRuleInTransaction(db, policyId, rule);
        }
    }

    async replaceConfiguration(
        db: Prisma.TransactionClient,
        agentId: string,
        input: AgentNetworkPolicyConfigurationWriteModel | null,
    ) {
        if (!input) {
            await db.agentNetworkPolicy.deleteMany({ where: { agentId } });
            return;
        }

        const existingPolicy = await db.agentNetworkPolicy.findUnique({ where: { agentId } });
        if (input.id && input.id !== existingPolicy?.id) {
            throw new ServiceException('Agent network policy configuration not found.');
        }

        const policy = existingPolicy
            ? await db.agentNetworkPolicy.update({
                where: { id: existingPolicy.id },
                data: { allowInternetAccess: input.allowInternetAccess },
            })
            : await db.agentNetworkPolicy.create({
                data: { agentId, allowInternetAccess: input.allowInternetAccess },
            });

        await this.replaceEgressRules(db, policy.id, input.rules.map(rule => ({
            id: rule.id,
            type: 'EGRESS',
            targetAppId: rule.targetAppId,
            port: rule.port,
            protocol: rule.protocol as 'TCP' | 'UDP',
        })));
    }

    async saveEgressRule(input: AgentNetworkPolicyEgressRuleEditModel & { agentId: string }, session?: UserSession) {
        const run = async (db: Prisma.TransactionClient) => {
            let projectId: string;
            const touches: NetworkPolicyMirrorTouch[] = [];
            try {
                const { policy, projectId: pid } = await this.ensurePolicyForAgent(db, input.agentId);
                projectId = pid;

                // When an existing rule changes target, port or protocol, remove
                // the mirrored counterpart of the old rule before saving and
                // mirroring the new one.
                const existingRule = input.id
                    ? await db.agentNetworkPolicyRule.findUnique({
                        where: { id: input.id },
                        select: { targetAppId: true, port: true, protocol: true },
                    })
                    : null;
                const ruleChanged = existingRule && (
                    existingRule.targetAppId !== input.targetAppId
                    || existingRule.port !== input.port
                    || existingRule.protocol !== input.protocol
                );
                if (session && existingRule && ruleChanged) {
                    touches.push(...await networkPolicyRuleMirrorService.unmirrorAgentEgressRule(
                        db, session, input.agentId, existingRule.targetAppId, existingRule.port, existingRule.protocol,
                    ));
                }

                await this.saveEgressRuleInTransaction(db, policy.id, input);
                if (session) {
                    touches.push(...await networkPolicyRuleMirrorService.mirrorAgentEgressRuleSave(
                        db, session, input.targetAppId, input.agentId, input.port, input.protocol,
                    ));
                }
                const counterpartAppIds = new Set([
                    input.targetAppId,
                    ...(existingRule ? [existingRule.targetAppId] : []),
                ]);
                const counterpartApps = await db.app.findMany({
                    where: { id: { in: Array.from(counterpartAppIds) } },
                    select: { id: true, projectId: true },
                });
                return { counterpartApps, touches };
            } finally {
                revalidateTag(Tags.agent(input.agentId));
                revalidateTag(Tags.agents(projectId!));
            }
        };
        const { counterpartApps, touches } = await dataAccess.client.$transaction(async (innerTx) => {
            return await run(innerTx);
        });
        this.invalidateCounterpartApps(counterpartApps);
        this.invalidateMirrorTouches(touches);
    }

    async deleteEgressRule(ruleId: string, session?: UserSession) {
        const rule = await dataAccess.client.agentNetworkPolicyRule.findUnique({
            where: { id: ruleId },
            include: { agentNetworkPolicy: { include: { agent: true } } },
        });
        if (!rule) {
            return;
        }
        let touches: NetworkPolicyMirrorTouch[] = [];
        try {
            touches = await dataAccess.client.$transaction(async (db) => {
                await db.agentNetworkPolicyRule.delete({
                    where: { id: ruleId },
                });
                return session
                    ? networkPolicyRuleMirrorService.unmirrorAgentEgressRule(
                        db, session, rule.agentNetworkPolicy.agentId, rule.targetAppId, rule.port, rule.protocol,
                    )
                    : [];
            });
        } finally {
            revalidateTag(Tags.agent(rule.agentNetworkPolicy.agentId));
            revalidateTag(Tags.agents(rule.agentNetworkPolicy.agent.projectId));
        }
        this.invalidateMirrorTouches(touches);
        const counterpartApp = await dataAccess.client.app.findFirst({
            where: { id: rule.targetAppId },
            select: { id: true, projectId: true },
        });
        if (counterpartApp) {
            this.invalidateCounterpartApps([counterpartApp]);
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
