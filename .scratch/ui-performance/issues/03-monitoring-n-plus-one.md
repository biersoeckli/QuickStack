# 03 — Monitoring: resolve N+1 and bundle polls

**What to build:** The monitoring page loads app resource, volume, and node values with a constant number of Kubernetes calls instead of one call per app. Instead of three independent interval pollers, one bundled, pausable poller runs.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Pod data is loaded once per namespace or cluster-wide and mapped to apps, instead of per app individually and sequentially.
- [ ] The number of Kubernetes calls no longer scales linearly with the app count (provable, e.g. via a test spy).
- [ ] Volume/PVC/Longhorn assignments use maps instead of a linear search per entry.
- [ ] The monitoring page uses one shared, pausable poller.
- [ ] The existing displays (cluster CPU/RAM/storage, app resources, volume capacity) stay functionally unchanged.
- [ ] Tests analogous to the existing monitoring-service unit tests.
