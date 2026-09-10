# 05 — Tab navigation without a server round trip

**What to build:** Switching between tabs and configuration sections (app tabs, agent detail, project overview, server settings) responds instantly and no longer triggers a full server reload of the page. Deep links to a specific tab/section keep working.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Tab/section state is client-side; a click triggers no server fetch of the page.
- [ ] Deep links (URL with tab/section) still open the correct tab directly; the URL is updated without a full reload.
- [ ] Inactive tabs stay unmounted, so no hidden pollers/streams start there.
- [ ] The content shown per tab and the permission checks stay unchanged.
- [ ] Proof: no new page/RSC request appears in the network panel when switching tabs.
