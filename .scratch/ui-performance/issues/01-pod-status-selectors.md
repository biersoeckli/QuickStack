# 01 — Pod status without global store subscription

**What to build:** Status indicators (app table, project status, monitoring, network graph) update only when the status of their own app changes. A single deployment event no longer causes a re-render wave across all indicators.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] All consumers of the pod-status store read their entry through a fine-grained selector (per app ID) instead of the whole store.
- [ ] Loading state and actions are read separately; actions are not read or called during render.
- [ ] Indicators are memoized so an event for app A does not re-render the indicators of other apps.
- [ ] The existing status presentation (shutdown, deployed, deploying, building, error, unknown, pod count) stays unchanged.
- [ ] Proof: a status event renders only the affected component (profiler/re-render count). Existing store unit tests stay green.
