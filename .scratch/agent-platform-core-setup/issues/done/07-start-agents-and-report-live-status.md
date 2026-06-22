Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Start an Agent end to end from its overview. On first start, create a model-restricted LiteLLM virtual key, assemble an **Agent Runtime Secret**, create a `SandboxClaim`, wait for readiness, and report status derived live from Claim, Sandbox, Pod, and event state.

## Acceptance criteria

- [ ] Starting creates or reuses an Agent virtual key restricted to the selected LiteLLM Model Alias, with no QuickStack-managed budget.
- [ ] The Agent Runtime Secret contains Gateway base URL, virtual key, decrypted Agent Environment Variables, and system prompt file content without exposing secret values to the UI or logs.
- [ ] Starting creates a SandboxClaim targeting the Agent's zero-replica SandboxWarmPool.
- [ ] The start action waits for readiness and reports success only when the Agent Pod is usable.
- [ ] Timeout and failure results include actionable Claim, Sandbox, Pod, scheduling, image, and Gateway diagnostics.
- [ ] Agent status is not persisted and maps live Kubernetes state into existing `DeploymentStatus` values; `BUILDING` remains App-only.
- [ ] User-facing `DEPLOYED` status text reads `Running`.
- [ ] Tests cover key creation, Secret contents, Claim creation, readiness, timeout/error, diagnostics, and status mapping.

## Blocked by

- [04-create-and-navigate-agents](./04-create-and-navigate-agents.md)
