# Run Configuration Migrations at startup

Some persisted-configuration changes cannot be expressed as Prisma Database Migration SQL because they derive one configuration shape from another using application rules. QuickStack therefore defines a **Configuration Migration**: a code-defined, versioned transform guarded by an applied marker, executed from the existing startup route on every server boot so it runs at most once per installation. Database Migrations (Prisma `migrate deploy`) remain the mechanism for schema and column changes.
