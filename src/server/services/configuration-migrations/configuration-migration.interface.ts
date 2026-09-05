/**
 * Contract implemented by every Configuration Migration.
 * A Configuration Migration transforms persisted QuickStack configuration from
 * one supported shape to another and runs at most once, guarded by an applied
 * marker. It is distinct from a Database Migration (Prisma migrate deploy).
 */
export interface ConfigurationMigration {
    readonly name: string;

    isAlreadyApplied(): Promise<boolean>;
    runMigration(): Promise<void>;
}
