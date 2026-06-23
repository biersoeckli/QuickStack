Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Add a fullscreen Agent terminal that reuses QuickStack's Kubernetes exec stream but starts OpenCode directly in the Agent container. Missing OpenCode must remain a visible custom-image contract error, with no shell fallback.

## Acceptance criteria

- [ ] Authorized users can open a fullscreen terminal for a running Agent.
- [ ] Terminal resolution targets the Agent Pod and Agent container derived from live Sandbox resources.
- [ ] The exec command starts OpenCode directly rather than `/bin/sh` or `/bin/bash`.
- [ ] Missing or failed OpenCode exits surface to the terminal without starting a fallback shell.
- [ ] Non-running Agents show a clear unavailable state and do not attempt exec.
- [ ] Terminal access enforces Agent read authorization before stream setup.
- [ ] Existing App shell terminal behavior remains unchanged.
- [ ] Tests verify Agent command selection, runtime resolution, authorization, and no-fallback behavior at the service boundary.

## Blocked by

- [07-start-agents-and-report-live-status](./07-start-agents-and-report-live-status.md)
