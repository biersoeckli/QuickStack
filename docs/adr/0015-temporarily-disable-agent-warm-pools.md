# Temporarily disable Agent warm pools

QuickStack assigns every Agent Sandbox its own LiteLLM virtual key and passes that key to the Sandbox through `SandboxClaim.spec.env`. The current Agent Sandbox controller cannot combine that per-claim key with warm-pool adoption: a claim that carries env bypasses the warm pool and cold-starts, while an adopted warm Sandbox does not receive the claim env. The two features are therefore incompatible.

Until a future Agent Sandbox controller version supports per-claim env injection during warm-pool adoption, QuickStack removes Warm Pool Replicas from the Agent configuration UI and always reconciles `SandboxWarmPool.spec.replicas` to `0`. The stored `warmPoolReplicas` values remain in the database and schema so the UI control can be restored later without a data migration; they are ignored by deploy while the feature is disabled.

## Considered Options

- **Keep the UI field and rely on cold-start bypass.** Rejected: the setting would be misleading and pre-warmed capacity would never be used.
- **Keep warm pools and fall back to an Agent-level shared key.** Rejected: it defeats per-sandbox key revocation, which is the reason for the per-sandbox keys.
- **Migrate stored values to `0`.** Rejected: it destroys the previous configuration for a future re-enable and is not needed while deploy ignores the values.

## Consequences

- Every Agent Sandbox start is a cold start.
- Warm Pool Replicas are not editable in the UI.
- Deploy reconciles every Agent's warm pool to `0`, including Agents with a stored non-zero value.
- The workloads table reports warm pools as disabled instead of showing the stored replica count.
- Revisit this decision when the Agent Sandbox controller can inject `SandboxClaim.spec.env` into warm-pool-adopted Sandboxes. Restore the UI field and the deploy wiring at that point.
