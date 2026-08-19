# Make App Network Policy Configuration explicit in Full Schema Writes

App Extended POST Upserts must carry `appNetworkPolicy` explicitly: an object replaces the complete App Network Policy Configuration and `null` removes it with its App Network Policy Rules. The App Network Policy module owns this replacement in the surrounding App transaction so policy identity, target normalization, rule validation, and reconciliation remain local instead of leaking into the App module.
