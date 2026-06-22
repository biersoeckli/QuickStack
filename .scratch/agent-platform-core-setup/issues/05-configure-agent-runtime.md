Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Add Agent general configuration for custom image, Kubernetes resource quantities, optional system prompt, Gateway/model selection, and encrypted **Agent Environment Variables**. Reconcile saved definition changes while stopped and prevent runtime-relevant drift while running.

## Acceptance criteria

- [ ] Users with write permission can choose the default image or enter a custom image.
- [ ] CPU and memory requests and limits accept valid Kubernetes Quantity strings and reject invalid values.
- [ ] Users can save an optional system prompt for later file projection into the Agent Runtime Secret.
- [ ] Agent Environment Variable values are encrypted with `CryptoUtils` and are not disclosed after save.
- [ ] Environment names must be Kubernetes-compatible and cannot use QuickStack-reserved runtime names.
- [ ] Gateway or model changes invalidate stored virtual-key state while the Agent is stopped.
- [ ] Runtime-relevant configuration cannot change while the Agent is running.
- [ ] Saving a stopped Agent reconciles its SandboxTemplate and SandboxWarmPool.
- [ ] Tests cover validation, encryption, running-state locks, credential invalidation, and reconciliation.

## Blocked by

- [04-create-and-navigate-agents](./04-create-and-navigate-agents.md)
