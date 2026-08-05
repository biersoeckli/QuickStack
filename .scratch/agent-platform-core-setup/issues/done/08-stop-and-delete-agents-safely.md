Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Complete Agent lifecycle cleanup. Stopping removes only runtime resources. Deleting cleans runtime resources, LiteLLM credentials, definition resources, and persistence while preserving retryability when credential cleanup fails. Prevent deletion of Gateways still referenced by Agents.

## Acceptance criteria

- [ ] Stopping deletes the SandboxClaim and Agent Runtime Secret.
- [ ] Stopping preserves the SandboxTemplate, SandboxWarmPool, Agent record, and virtual-key state for restart.
- [ ] Deleting a running Agent first removes its runtime resources.
- [ ] Successful deletion removes the virtual key, SandboxWarmPool, SandboxTemplate, and DB Agent without leaving owned resources.
- [ ] If virtual-key deletion fails, Agent deletion fails and retains the DB Agent so cleanup can be retried.
- [ ] LLM Gateway deletion is rejected while any Agent references it.
- [ ] Repeated stop and cleanup requests handle already-absent Kubernetes runtime resources safely.
- [ ] Tests cover stopped and running deletion, cleanup failure, retry behavior, resource preservation, and Gateway reference blocking.

## Blocked by

- [07-start-agents-and-report-live-status](./07-start-agents-and-report-live-status.md)
