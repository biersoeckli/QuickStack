# Migrate Apps from Simple to Extended App Network Policy Configuration

Only the **Extended App Network Policy Configuration** will remain supported; each App still in **Simple** mode is converted by the Network Policy Mode Migration so the mode can later be enforced as `EXTENDED` for every App. The Simple policy enums are translated per direction — ingress `ALLOW_ALL`/`NAMESPACE_ONLY` produce ingress rules from every other App in the same project on the App's internal ports, egress `ALLOW_ALL`/`NAMESPACE_ONLY` produce egress rules to every other App on that App's internal ports, egress enables Internet access only for `ALLOW_ALL`/`INTERNET_ONLY`, and `DENY_ALL`/`INTERNET_ONLY` produce no rules. Simple semantics that Extended cannot express are deliberately normalized: egress DNS is always allowed, and Traefik ingress to an App with a configured App Domain is always permitted. Live Kubernetes NetworkPolicies are not reconciled by the migration; the next deployment applies the Extended configuration, so the previously enforced Simple policy stays in force until then.

## Consequences

- Apps already in **Extended** mode are untouched. Apps in **Simple** mode have any dormant Extended configuration replaced by the derived rules so the migrated state exactly matches the current Simple firewall.
- Apps with network policies disabled are flipped to `EXTENDED` with no configuration written.
- The legacy Simple enum columns are kept as the pre-migration record; a separate later cleanup removes them once only **Extended** mode is enforced.
