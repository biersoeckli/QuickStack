# Per-sandbox agent volumes use native SandboxClaim volume claim templates

An **Agent Volume** now has a **Volume Type**. `ALL` keeps the existing **Shared Agent Volume**: one shared, persistent `ReadWriteMany` claim per Agent Volume, mounted by every Agent Sandbox instance and surviving sandbox deletion. `PER_SANDBOX` gives each Agent Sandbox instance its own claim, provisioned from the Agent Volume's configuration and deleted with the sandbox.

PER_SANDBOX is built on the Agent Sandbox controller's native `volumeClaimTemplates`: the Agent's SandboxTemplate declares one claim template per PER_SANDBOX Agent Volume and allows start-time overrides, and a start that carries a **Custom Tag** sends the matching claim templates so the controller cold-starts a Sandbox and creates a per-sandbox claim it owns and deletes. The consequence, accepted deliberately, is that tag-scoped data does not survive sandbox deletion.

## Considered Options

- **Shared, persistent claim keyed by Custom Tag.** Rejected: the native claim templates that carry per-start volume information always produce per-sandbox claims named after the sandbox, owned and deleted by the controller, so a stable claim selected at start time is not expressible. Keeping such a claim would require a SandboxTemplate and SandboxWarmPool per tag, or creating Sandboxes directly and reworking the claim-based status, stop, and exec paths.
- **A claim per sandbox with no Custom Tag.** Rejected: the tag is needed to identify which sandbox a per-sandbox claim belonged to.

## Consequences

- `ReadWriteOnce` becomes valid for PER_SANDBOX Agent Volumes, because no two sandboxes share a claim.
- PER_SANDBOX starts that carry a Custom Tag bypass the warm pool and cold-start; untagged starts may still use it.
- A PER_SANDBOX claim is not resized when the Agent Volume changes; only newly started sandboxes pick up new configuration.
