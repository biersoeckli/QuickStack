# 08 — Deployment status stream: shared watch + map lookup

**What to build:** A single server-side watch over deployments serves all connected browser clients. Many open tabs no longer lead to many Kubernetes watches, and the initial status is determined via a lookup map instead of a search per app.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Exactly one watch over deployments runs regardless of the number of clients; events are distributed to all subscribers.
- [ ] New clients attach and detach correctly on disconnect; no watch leftovers remain.
- [ ] The initial status uses a deployment lookup map instead of a linear search per app.
- [ ] Live status updates still arrive in the UI in real time, unchanged.
- [ ] Proof: multiple clients/tabs produce exactly one watch (log/test); initial status does not scale with apps × deployments.
