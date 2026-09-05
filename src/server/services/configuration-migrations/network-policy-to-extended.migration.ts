import dataAccess from '../../adapter/db.client';
import { ConfigurationMigration } from './configuration-migration.interface';
import { deriveExtendedConfiguration } from './network-policy-to-extended.derivation';

export const NETWORK_POLICY_TO_EXTENDED_MIGRATION_PARAMETER = 'networkPolicyToExtendedMigrationApplied';

/**
 * Network Policy Mode Migration: converts every App still in Simple mode to the
 * Extended App Network Policy Configuration that reproduces its current Simple
 * behavior. Runs at most once, guarded by a Parameter applied marker that is
 * written in the same transaction as the conversion.
 */
class NetworkPolicyToExtendedMigration implements ConfigurationMigration {
    readonly name = 'network-policy-to-extended';

    async isAlreadyApplied(): Promise<boolean> {
        const marker = await dataAccess.client.parameter.findUnique({
            where: { name: NETWORK_POLICY_TO_EXTENDED_MIGRATION_PARAMETER },
        });
        return marker !== null;
    }

    async runMigration(): Promise<void> {
        await dataAccess.client.$transaction(async (db) => {
            const simpleApps = await db.app.findMany({
                where: { networkPolicyMode: 'SIMPLE' },
                include: { appPorts: true },
            });

            const allApps = await db.app.findMany({
                select: {
                    id: true,
                    projectId: true,
                    appPorts: { select: { port: true } },
                },
            });
            const projectApps = new Map<string, { id: string; appPorts: { port: number }[] }[]>();
            for (const app of allApps) {
                const apps = projectApps.get(app.projectId) ?? [];
                apps.push(app);
                projectApps.set(app.projectId, apps);
            }

            for (const app of simpleApps) {
                const peers = (projectApps.get(app.projectId) ?? []).filter(peer => peer.id !== app.id);
                const derivation = deriveExtendedConfiguration(app, peers);

                await db.appNetworkPolicy.deleteMany({ where: { appId: app.id } });
                if (app.useNetworkPolicy) {
                    await db.appNetworkPolicy.create({
                        data: {
                            appId: app.id,
                            allowInternetAccess: derivation.allowInternetAccess,
                            rules: {
                                create: derivation.rules.map(rule => ({
                                    type: rule.type,
                                    targetAppId: rule.targetAppId,
                                    port: rule.port,
                                    protocol: rule.protocol,
                                })),
                            },
                        },
                    });
                }
                await db.app.update({
                    where: { id: app.id },
                    data: { networkPolicyMode: 'EXTENDED' },
                });
            }

            await db.parameter.upsert({
                where: { name: NETWORK_POLICY_TO_EXTENDED_MIGRATION_PARAMETER },
                create: { name: NETWORK_POLICY_TO_EXTENDED_MIGRATION_PARAMETER, value: 'true' },
                update: {},
            });
        });
    }
}

const networkPolicyToExtendedMigration = new NetworkPolicyToExtendedMigration();
export default networkPolicyToExtendedMigration;
