/**
 * Contract implemented by every Configuration Migration.
 * A Configuration Migration transforms persisted QuickStack configuration from
 * one supported shape to another. The registry records the latest completed
 * migration and therefore controls which migrations still need to run.
 * It is distinct from a Database Migration (Prisma migrate deploy).
 */
export interface ConfigurationMigration {
    readonly name: string;

    runMigration(): Promise<void>;
}
