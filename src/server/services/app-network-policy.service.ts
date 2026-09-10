import { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import dataAccess from '../adapter/db.client';
import { Tags } from '../utils/cache-tag-generator.utils';
import { ServiceException } from '@/shared/model/service.exception.model';
import { AppNetworkPolicyRuleEditModel } from '@/shared/model/app-network-policy-edit.model';
import { NetworkPolicyRuleUtils } from '@/shared/utils/network-policy-rule.utils';
import { AppExtendedWriteModel } from '@/shared/model/app-extended.model';
import { UserSession } from '@/shared/model/sim-session.model';
import networkPolicyRuleMirrorService, { NetworkPolicyMirrorTouch } from './network-policy-rule-mirror.service';

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

    private invalidateMirrorTouches(touches: NetworkPolicyMirrorTouch[]) {
        for (const touch of touches) {
            if (touch.workloadType === 'AGENT') {
                revalidateTag(Tags.agent(touch.workloadId));
                revalidateTag(Tags.agents(touch.projectId));
            } else {
                revalidateTag(Tags.app(touch.workloadId));
                revalidateTag(Tags.apps(touch.projectId));
            }
        }
    }

    private invalidateCounterpartApps(apps: { id: string; projectId: string }[]) {
        for (const app of apps) {
            revalidateTag(Tags.app(app.id));
            revalidateTag(Tags.apps(app.projectId));
        }
    }

    private invalidateCounterpartAgents(agents: { id: string; projectId: string }[]) {
        for (const agent of agents) {
            revalidateTag(Tags.agent(agent.id));
            revalidateTag(Tags.agents(agent.projectId));
        }
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

    async savePolicyConfiguration(input: {
        appId: string;
        useNetworkPolicy: boolean;
        allowInternetAccess: boolean;
        rules: AppNetworkPolicyRuleEditModel[];
    }, session?: UserSession): Promise<NetworkPolicyMirrorTouch[]> {
        const { app, counterpartAgents, counterpartApps, touches } = await dataAccess.client.$transaction(async (db) => {
            const { app, policy } = await this.ensurePolicy(db, input.appId);
            await db.app.update({
                where: { id: input.appId },
                data: {
                    useNetworkPolicy: input.useNetworkPolicy,
                },
            });
            await db.appNetworkPolicy.update({
                where: { id: policy.id },
                data: { allowInternetAccess: input.allowInternetAccess },
            });

            // Snapshot the current rules before replaceRules deletes the ones
            // that are no longer submitted, so their mirrored counterparts on
            // the peers can be removed alongside.
            const previousRules = await db.appNetworkPolicyRule.findMany({
                where: { appNetworkPolicyId: policy.id },
                select: {
                    type: true,
                    targetAppId: true,
                    targetAgentId: true,
                    port: true,
                    protocol: true
                },
            });

            await this.replaceRules(db, input.appId, policy.id, input.rules);

            const touches: NetworkPolicyMirrorTouch[] = [];
            if (session) {
                const removedRules = previousRules
                    .map(previous => NetworkPolicyRuleUtils.fromStoredRule(previous))
                    .filter(previous => !input.rules.some(next => NetworkPolicyRuleUtils.hasSameContent(
                        previous,
                        NetworkPolicyRuleUtils.fromEditRule(next),
                    )));
                if (removedRules.length > 0) {
                    const unmirrorTouches = await networkPolicyRuleMirrorService.unmirrorAppRules(
                        db, session, input.appId, removedRules,
                    );
                    touches.push(...unmirrorTouches);
                }
            }
            touches.push(...await networkPolicyRuleMirrorService.mirrorAppConfigurationSave(db, session, input.appId, input.rules));
            const counterpartAppIds = new Set([
                ...previousRules.flatMap(rule => rule.targetAppId ? [rule.targetAppId] : []),
                ...input.rules.flatMap(rule => rule.targetType === 'APP' ? [rule.targetId] : []),
            ]);
            const counterpartApps = counterpartAppIds.size > 0
                ? await db.app.findMany({
                    where: { id: { in: Array.from(counterpartAppIds) } },
                    select: { id: true, projectId: true },
                })
                : [];
            const counterpartAgentIds = new Set([
                ...previousRules.flatMap(rule => rule.targetAgentId ? [rule.targetAgentId] : []),
                ...input.rules.flatMap(rule => rule.targetType === 'AGENT' ? [rule.targetId] : []),
            ]);
            const counterpartAgents = counterpartAgentIds.size > 0
                ? await db.agent.findMany({
                    where: { id: { in: Array.from(counterpartAgentIds) } },
                    select: { id: true, projectId: true },
                })
                : [];
            return { app, counterpartAgents, counterpartApps, touches };
        });
        await this.invalidate(app.id, app.projectId);
        this.invalidateCounterpartApps(counterpartApps);
        this.invalidateCounterpartAgents(counterpartAgents);
        this.invalidateMirrorTouches(touches);
        return touches;
    }
}

const appNetworkPolicyService = new AppNetworkPolicyService();
export default appNetworkPolicyService;
