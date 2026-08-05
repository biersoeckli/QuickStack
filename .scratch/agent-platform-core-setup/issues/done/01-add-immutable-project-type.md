Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Add immutable **Project Type** selection to Project creation. Existing Projects migrate to **App Projects**. App Projects continue supporting Apps, while Agent Projects reject Apps and provide an Agent-oriented empty overview.

## Acceptance criteria

- [ ] Existing Projects migrate to Project Type `App`, with existing App behavior preserved.
- [ ] Project creation requires selecting App or Agent and persists that choice.
- [ ] Project Type cannot be changed after creation through any supported write path.
- [ ] App creation is rejected for Agent Projects, including server-side enforcement.
- [ ] Project pages identify the selected Project Type and Agent Projects do not render App creation or App-only overview controls.
- [ ] Tests cover migration defaults, immutable updates, and mixed-workload rejection.

## Blocked by

None - can start immediately
