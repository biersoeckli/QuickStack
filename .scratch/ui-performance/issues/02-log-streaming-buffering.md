# 02 — Bound log streaming and buffer SSE frames correctly

**What to build:** Live logs for pods and builds stay smooth and memory-stable even during long, continuous streams. Stream frames that arrive incomplete are no longer lost.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Log views keep only the last N lines (configurable); memory does not grow without bound.
- [ ] UI updates are throttled (animation frame or short interval); auto-scroll to the end stays correct.
- [ ] A reusable SSE parser buffers incomplete frames and loses no `data:` messages, even when one frame is split across several chunks or several frames arrive in one chunk.
- [ ] The pod-status stream uses the same frame parser.
- [ ] Proof: unit tests for the frame buffer and log cap; manual long-running stream without memory growth.
