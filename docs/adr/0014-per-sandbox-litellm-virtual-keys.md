# LiteLLM virtual keys belong to individual Agent Sandboxes

QuickStack creates one LiteLLM virtual key and one Kubernetes **Sandbox Virtual Key Secret** for each new Agent Sandbox instance instead of sharing an Agent-level key. Stop deletes the Sandbox/Claim, then attempts LiteLLM key deletion and always deletes its Secret; Suspend and Resume retain both. A Custom Tag is the LiteLLM `user_id`: QuickStack finds or creates that user before generating the sandbox key, so LiteLLM can attribute tagged sandbox usage while a stopped tag can start again with a fresh key. The prior Agent-level key is removed during migration even though this can revoke access from already running legacy sandboxes; this explicitly favours removal of shared credentials over backwards compatibility.

## Considered Options

- **One key per Agent.** Rejected: it prevents sandbox-level revocation and mixes usage across separate sandbox instances.
- **One reusable key per Custom Tag.** Rejected: stopping and starting a tagged sandbox would reuse a credential, contrary to the per-instance lifecycle.
- **Retain legacy Agent keys until every old sandbox stops.** Rejected: it needs cross-version lifecycle tracking and leaves a shared credential active; an immediate cut-over is accepted.

## Consequences

- LiteLLM user records outlive sandboxes. QuickStack does not delete a user when its last sandbox stops.
- A LiteLLM delete failure is logged but does not fail Stop, and the Kubernetes Secret is still deleted; an orphaned LiteLLM key is an accepted operational risk.
- The key is written to a **Sandbox Virtual Key Secret** and also passed as a plain `SandboxClaim.spec.env` value. The Secret remains while the Sandbox exists and is QuickStack's inventory view of open and valid keys; it is not mounted into the pod. Passing the value in the claim is required because the Agent Sandbox API has no `valueFrom.secretKeyRef` for claim env.
- Warm pools are temporarily disabled while keys are assigned per Sandbox; see ADR 0015.
