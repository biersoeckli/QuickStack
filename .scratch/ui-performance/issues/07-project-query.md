# 07 — Trim the project query

**What to build:** The sidebar and projects table load projects without the full app and agent objects. Only name/ID or the number of agents is needed.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The sidebar and projects table no longer need complete app/agent records.
- [ ] The agent count per project is determined via a count instead of loaded objects.
- [ ] Filtering by read permission for projects and workloads stays correct.
- [ ] Cache tags and invalidation stay functional.
- [ ] Proof: the transferred payload for projects/sidebar decreases; existing role/access tests stay green.
