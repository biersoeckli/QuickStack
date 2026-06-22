Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Extend **Workload Permissions** to Agents. Admins can grant read or write access to individual Agents, and all Agent pages and Server Actions enforce the same shared authorization model used by Apps.

## Acceptance criteria

- [ ] Admin role editing can grant object-level read or write permission to an Agent.
- [ ] Agent Project-level permissions apply when no object-level Workload Permissions are configured.
- [ ] Object-level grants restrict visibility and actions to the granted Agents when configured.
- [ ] Agent navigation, reads, creates, saves, starts, stops, and deletes enforce shared authorization checks appropriate to each action.
- [ ] Unauthorized direct Server Action calls are rejected, not only hidden in the UI.
- [ ] Tests cover admin, Project fallback, Agent-specific read/write, hidden Agents, and denied writes.

## Blocked by

- [02-make-project-authorization-workload-neutral](./02-make-project-authorization-workload-neutral.md)
- [04-create-and-navigate-agents](./04-create-and-navigate-agents.md)
