# Make workload Network Policy Configuration explicit in Full Schema Writes

App and Agent Extended POST Upserts must carry their Network Policy Configuration explicitly: an object replaces the complete configuration and `null` removes it with its rules. The respective Network Policy module owns this replacement in the surrounding workload transaction so policy identity, target normalization, rule validation, and reconciliation remain local instead of leaking into the workload module.
