Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Refactor Project authorization around **Project Workloads** and **Workload Permissions** so permission checks no longer assume every workload is an App. Keep all existing App authorization behavior intact and expose transport-independent checks reusable by Server Actions and future APIs.

## Acceptance criteria

- [ ] Project permission persistence and application models use workload-neutral concepts without losing existing grants.
- [ ] Shared authorization checks support Project-level and object-level Project Workload access.
- [ ] Existing App Server Actions use the shared checks and retain current authorization behavior.
- [ ] Admin behavior and Project-level fallback behavior remain unchanged.
- [ ] Tests cover read, write, denied, object-level, Project-level fallback, and admin cases.

## Blocked by

None - can start immediately
