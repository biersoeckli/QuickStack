import networkPolicyToExtendedMigration from './network-policy-migration/network-policy-to-extended.migration';
import { ConfigurationMigration } from './configuration-migration.interface';
import paramService, { ParamService } from '../param.service';

class ConfigurationMigrationRegistryService {
    private readonly migrations: readonly ConfigurationMigration[] = [
        networkPolicyToExtendedMigration,
    ];

    getAll(): readonly ConfigurationMigration[] {
        return this.migrations;
    }

    async runPending(): Promise<void> {
        const latestCompletedMigration = await paramService.getOrUndefinedUncached(
            ParamService.LATEST_COMPLETED_CODE_MIGRATION,
        );
        const latestCompletedMigrationIndex = latestCompletedMigration
            ? this.migrations.findIndex(migration => migration.name === latestCompletedMigration.value)
            : -1;

        if (latestCompletedMigration && latestCompletedMigrationIndex === -1) {
            throw new Error(`Unknown completed configuration migration: ${latestCompletedMigration.value}`);
        }

        for (const migration of this.migrations.slice(latestCompletedMigrationIndex + 1)) {
            await migration.runMigration();
            await paramService.save({
                name: ParamService.LATEST_COMPLETED_CODE_MIGRATION,
                value: migration.name,
            });
        }
    }
}

const configurationMigrationRegistryService = new ConfigurationMigrationRegistryService();
export default configurationMigrationRegistryService;
