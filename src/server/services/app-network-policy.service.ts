import { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import dataAccess from '../adapter/db.client';
import { Tags } from '../utils/cache-tag-generator.utils';
import { ServiceException } from '@/shared/model/service.exception.model';
import { AppNetworkPolicyRuleEditModel, AppNetworkPolicySettingsModel } from '@/shared/model/app-network-policy-edit.model';
import { AppExtendedWriteModel } from '@/shared/model/app-extended.model';

type AppNetworkPolicyConfigurationWriteModel = NonNullable<AppExtendedWriteModel['appNetworkPolicy']>;

class AppNetworkPolicyService {
    private async ensurePolicy(db: Prisma.TransactionClient, appId: string) {
        const app = await db.app.findUniqueOrThrow({
            where: { id: appId },
        });
        const policy = await db.appNetworkPolicy.upsert({
            where: { appId },
            create: { appId },
            update: {},
        });
        return { app, policy };
    }

    private async invalidate(appId: string, projectId: string) {
        revalidateTag(Tags.app(appId));
        revalidateTag(Tags.apps(projectId));
    }

    private async saveRuleInTransaction(
        db: Prisma.TransactionClient,
        appId: string,
        policyId: string,
        input: AppNetworkPolicyRuleEditModel,
    ) {
        if (input.targetType === 'APP' && input.targetId === appId) {
            throw new ServiceException('An app cannot reference itself.');
        }

        if (input.targetType === 'APP') {
            const targetApp = await db.app.findUnique({
                where: { id: input.targetId },
            });
            if (!targetApp) {
                throw new ServiceException('Referenced app not found.');
            }
        } else {
            const targetAgent = await db.agent.findUnique({
                where: { id: input.targetId },
            });
            if (!targetAgent) {
                throw new ServiceException('Referenced agent not found.');
            }
        }

        const targetWhere = input.targetType === 'APP'
            ? { targetAppId: input.targetId }
            : { targetAgentId: input.targetId };
        const duplicate = await db.appNetworkPolicyRule.findFirst({
            where: {
                appNetworkPolicyId: policyId,
                ...targetWhere,
                type: input.type,
                port: input.port,
                protocol: input.protocol,
                id: input.id ? { not: input.id } : undefined,
            },
        });
        if (duplicate) {
            throw new ServiceException('A matching network policy rule already exists.');
        }

        if (input.id) {
            const existing = await db.appNetworkPolicyRule.findFirst({
                where: { id: input.id, appNetworkPolicyId: policyId },
            });
            if (!existing) {
                throw new ServiceException('Network policy rule not found.');
            }

            return await db.appNetworkPolicyRule.update({
                where: { id: input.id },
                data: {
                    targetAppId: input.targetType === 'APP' ? input.targetId : null,
                    targetAgentId: input.targetType === 'AGENT' ? input.targetId : null,
                    type: input.type,
                    port: input.port,
                    protocol: input.protocol,
                },
            });
        }

        return await db.appNetworkPolicyRule.create({
            data: {
                ...targetWhere,
                type: input.type,
                port: input.port,
                protocol: input.protocol,
                appNetworkPolicyId: policyId,
            },
        });
    }

    private async replaceRules(
        db: Prisma.TransactionClient,
        appId: string,
        policyId: string,
        rules: AppNetworkPolicyRuleEditModel[],
    ) {
        const savedRuleIds: string[] = [];

        for (const rule of rules) {
            const savedRule = await this.saveRuleInTransaction(db, appId, policyId, rule);
            savedRuleIds.push(savedRule.id);
        }

        await db.appNetworkPolicyRule.deleteMany({
            where: {
                appNetworkPolicyId: policyId,
                id: { notIn: savedRuleIds },
            },
        });
    }

    async replaceConfiguration(
        db: Prisma.TransactionClient,
        appId: string,
        input: AppNetworkPolicyConfigurationWriteModel | null,
    ) {
        if (!input) {
            await db.appNetworkPolicy.deleteMany({ where: { appId } });
            return;
        }

        const existingPolicy = await db.appNetworkPolicy.findUnique({ where: { appId } });
        if (input.id && input.id !== existingPolicy?.id) {
            throw new ServiceException('App network policy configuration not found.');
        }

        const policy = existingPolicy
            ? await db.appNetworkPolicy.update({
                where: { id: existingPolicy.id },
                data: { allowInternetAccess: input.allowInternetAccess },
            })
            : await db.appNetworkPolicy.create({
                data: { appId, allowInternetAccess: input.allowInternetAccess },
            });

        await this.replaceRules(db, appId, policy.id, input.rules.map(rule => ({
            id: rule.id,
            type: rule.type as 'INGRESS' | 'EGRESS',
            targetType: rule.targetAppId ? 'APP' : 'AGENT',
            targetId: rule.targetAppId ?? rule.targetAgentId!,
            port: rule.port,
            protocol: rule.protocol as 'TCP' | 'UDP',
        })));
    }

    async saveSettings(input: AppNetworkPolicySettingsModel & { appId: string }) {
        const { app } = await dataAccess.client.$transaction(async (db) => {
            const result = await this.ensurePolicy(db, input.appId);
            await db.app.update({
                where: { id: input.appId },
                data: {
                    networkPolicyMode: input.mode,
                    useNetworkPolicy: input.useNetworkPolicy,
                },
            });
            await db.appNetworkPolicy.update({
                where: { id: result.policy.id },
                data: { allowInternetAccess: input.allowInternetAccess },
            });
            return result;
        });
        await this.invalidate(app.id, app.projectId);
    }

    async saveRule(input: AppNetworkPolicyRuleEditModel & { appId: string }) {
        const { app } = await dataAccess.client.$transaction(async (db) => {
            const { app, policy } = await this.ensurePolicy(db, input.appId);
            await this.saveRuleInTransaction(db, app.id, policy.id, input);
            return { app };
        });
        await this.invalidate(app.id, app.projectId);
    }

    async deleteRule(ruleId: string) {
        const rule = await dataAccess.client.appNetworkPolicyRule.findUnique({
            where: { id: ruleId },
            include: { appNetworkPolicy: { include: { app: true } } },
        });
        if (!rule) {
            return;
        }
        await dataAccess.client.appNetworkPolicyRule.delete({
            where: { id: ruleId },
        });
        await this.invalidate(rule.appNetworkPolicy.appId, rule.appNetworkPolicy.app.projectId);
    }

    async getRuleById(ruleId: string) {
        const rule = await dataAccess.client.appNetworkPolicyRule.findUnique({
            where: { id: ruleId },
            include: { appNetworkPolicy: true },
        });
        if (!rule) {
            throw new ServiceException('Network policy rule not found.');
        }
        return rule;
    }
}

const appNetworkPolicyService = new AppNetworkPolicyService();
export default appNetworkPolicyService;
