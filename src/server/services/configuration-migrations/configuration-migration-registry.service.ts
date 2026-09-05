import networkPolicyToExtendedMigration from './network-policy-to-extended.migration';
import { ConfigurationMigration } from './configuration-migration.interface';

class ConfigurationMigrationRegistryService {
    private readonly migrations: readonly ConfigurationMigration[] = [
        networkPolicyToExtendedMigration,
    ];

    getAll(): readonly ConfigurationMigration[] {
        return this.migrations;
    }

    async runPending(): Promise<void> {
        for (const migration of this.migrations) {
            if (!(await migration.isAlreadyApplied())) {
                await migration.runMigration();
            }
        }
    }
}

const configurationMigrationRegistryService = new ConfigurationMigrationRegistryService();
export default configurationMigrationRegistryService;
