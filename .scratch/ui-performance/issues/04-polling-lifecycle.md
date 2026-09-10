# 04 — Polling lifecycle in app/agent overview

**What to build:** An open app overview no longer runs several parallel timers and streams without cleanup. On leave, all timers and streams are stopped; when the browser tab is hidden, polling pauses and resumes on visibility.

**Blocked by:** 03 — Monitoring: resolve N+1 and bundle polls (the shared poller/hook is introduced there).

**Status:** ready-for-agent

- [ ] Monitoring, deployment, and pod updates in the overview share one lifecycle (shared hook/poller).
- [ ] No `setInterval`/`setTimeout` leftovers remain after unmount.
- [ ] Polling pauses on `document.hidden` and resumes on visibility.
- [ ] Terminal and log functions remain usable unchanged.
- [ ] Proof: unmount test with fake timers and no open timers; test for visibility changes. The behavior applies analogously to the agent overview.
