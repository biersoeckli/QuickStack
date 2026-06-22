Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Add Agent general configuration split into independent per-card forms (Source, Rate Limits, System Prompt, Environment Variables). Each card saves individually to the database. A separate "Deploy" button reconciles all saved configuration to Kubernetes via SandboxTemplate and SandboxWarmPool. Prevent runtime-relevant drift while running.

## Acceptance criteria

- [ ] Users with write permission can choose the default image or enter a custom image.
- [ ] CPU and memory requests and limits accept integer values in millicores (CPU) and MB (memory), converted to Kubernetes quantity strings at the K8s adapter boundary.
- [ ] Users can save individual configuration cards (Source, Rate Limits, System Prompt, Env Vars) independently to the database.
- [ ] A "Deploy" button reconciles the latest saved configuration to the Agent's SandboxTemplate and SandboxWarmPool.
- [ ] Users can save an optional system prompt for later file projection into the Agent Runtime Secret.
- [ ] Agent Environment Variable values are encrypted with `CryptoUtils` and are not disclosed after save.
- [ ] Environment names must be Kubernetes-compatible and cannot use QuickStack-reserved runtime names.
- [ ] Gateway or model changes invalidate stored virtual-key state while the Agent is stopped.
- [ ] Runtime-relevant configuration cannot change while the Agent is running.
- [ ] Tests cover integer validation, per-card persistence, encryption, running-state locks, credential invalidation, and deploy-time reconciliation.

## Blocked by

- [04-create-and-navigate-agents](./04-create-and-navigate-agents.md)
