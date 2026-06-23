Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Add Agent-specific logs and events views using the existing QuickStack streaming experience. Logs come from the Agent container, while events combine SandboxClaim, generated Sandbox, and Pod diagnostics to expose runtime and custom-image failures.

## Acceptance criteria

- [ ] Authorized users can stream logs from the running Agent container.
- [ ] Logs clearly report when no running Agent Pod is available.
- [ ] Agent events include relevant SandboxClaim, generated Sandbox, and Pod events in useful order.
- [ ] Image pull, missing command, scheduling, readiness, and controller failures surface actionable messages where Kubernetes provides them.
- [ ] Logs and events views enforce Agent read authorization.
- [ ] Existing App log behavior remains unchanged.
- [ ] Tests cover resource selection, combined diagnostics, unavailable runtime behavior, and authorization.

## Blocked by

- [07-start-agents-and-report-live-status](./07-start-agents-and-report-live-status.md)
