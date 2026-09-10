# PRD — UI & Fetch Performance for Large Instances

**Status:** ready-for-agent

## Problem Statement

The starting point is a QuickStack instance with roughly 100 apps and 30 agents. The interface feels sluggish: clicks, navigation, and tab/section switches are slow, status indicators and live logs stutter, and the monitoring and app-overview pages create high server and Kubernetes load.

Observed causes from the code analysis (numbers refer to the analysis findings):

1. Status components subscribe to the entire pod-status store instead of only their own entry. Every single deployment event therefore re-renders all indicators (a re-render wave including tooltips at 100 apps/30 agents).
2. Live log views append to an unbounded growing string and do not correctly buffer incoming SSE frames. Long build/pod logs get slow, consume memory, and individual events are lost.
3. The monitoring fetch loads pods per app in a sequential loop (N+1 toward the Kubernetes API), and the monitoring page runs three independent pollers.
4. Tab/section switches trigger a full server round trip through the URL and each kick off the full fetch chain.
5. The app-list query returns the complete app model including all relations, although the table and breadcrumbs only need a few fields.
6. The project query returns all apps and agents in full for the sidebar and projects table, although only names or counts are needed.
12. On the app overview, several overlapping pollers/timeouts run at once and are not cleaned up on leave.
13. The deployment-status stream opens a separate Kubernetes watch per browser client, and the initial status searches all deployments per app with `find`.

Together these cause noticeable click and navigation latency, stuttering live views, and unnecessary load that grows linearly (or worse) with the number of apps/agents.

## Solution

The eight identified workstreams are implemented as one verifiable increment each:

- **Fine-grained state subscriptions:** status indicators only re-render when their own entry changes.
- **Stable log streaming:** bounded log buffer, throttled UI updates, and correctly buffered SSE frames.
- **Constant monitoring fetch:** Kubernetes data is loaded once per namespace/cluster and mapped to apps; the monitoring page uses one bundled poller.
- **Clean poll lifecycle:** shared pollers/timeouts with cleanup and pause when the tab is hidden.
- **Client-side tab navigation:** instant tab/section switching without a server reload; deep links keep working.
- **Lean list queries:** app list, breadcrumbs, sidebar, and projects table load only the required fields/counts; the full model stays reserved for the detail page.
- **Shared deployment-status stream:** one server-side watch serves all clients, initial status via map lookup.

Goal: clicks and navigation feel instant, live views stay memory-stable, and server/K8s load no longer scales linearly with the app count.

## User Stories

1. As an operator with ~100 apps, I want a status change of one app to update only the affected status indicator, so the UI does not freeze during many parallel deployment events.
2. As an operator, I want to scroll and click smoothly in the app table even with 100 rows, so I can find apps quickly.
3. As an operator, I want the project status indicator to be recomputed only when an app in the project changes, so the projects table stays stable.
4. As an operator, I want to watch live pod logs for a long time without the view slowing down or crashing.
5. As an operator, I want to see live build logs smoothly even for very long builds, so I spot errors immediately.
6. As an operator, I want no log entries to be lost because of incomplete stream frames.
7. As an operator, I want the monitoring page to load quickly with 100 apps and not get slower as the app count grows.
8. As an operator, I want the monitoring refresh to run centrally only once, so the page is not burdened by multiple parallel pollers.
9. As an operator, I want polling to pause when the browser tab is in the background, so resources are saved.
10. As an operator, I want no noticeable delay when switching between app tabs, so I can move quickly between overview, environment, domains, and storage.
11. As an operator, I want immediate feedback when switching agent configuration sections, without the page reloading.
12. As an operator, I want to switch server-settings tabs quickly without reloading all server data every time.
13. As an operator, I want to share deep links to a specific tab/section, so colleagues can send me straight to the right place.
14. As an operator, I want the app list to load quickly because no app relations are transferred anymore.
15. As an operator, I want breadcrumb dropdowns to open quickly because only the required fields are loaded.
16. As an operator, I want the sidebar to render quickly because projects are loaded without full app/agent objects.
17. As an operator, I want the projects table to show the agent count without loading all agent objects.
18. As an operator, I want the app overview to not run several timers in parallel, so the page does not make unnecessary background requests.
19. As an operator, I want all timers/streams to be cleanly stopped when leaving an app page, so no resources leak.
20. As an operator, I want many open browser tabs to not lead to many Kubernetes watches, so the server stays scalable.
21. As an operator, I want the first status sync after opening to be fast, even with 100 apps.
22. As an operator, I want live status updates to still arrive in real time after the watch is shared.
23. As a developer, I want fine-grained store selectors as the pattern, so new UI components do not render globally again.
24. As a developer, I want reusable utilities for SSE framing and log buffering, so streaming components stay consistent.
25. As a developer, I want tests that check call/re-render counts, so performance regressions are caught.

## Implementation Decisions

- **Seam:** Prefer existing test seams — Vitest unit tests alongside services/utils (`*.unit.spec.ts`) and integration tests under `src/__tests__/integration`. UI behavior via React Testing Library (already a dependency). New seams only where a new utility is introduced (SSE framer, log buffer, poll lifecycle hook).
- **Pod status:** The store API stays the same. Consumers read their entry through a fine-grained selector (`state.podsStatus.get(appId)`), `isLoading` separately, and actions are not read during render. Indicators are memoized.
- **Polling:** One shared, visibility-aware poller/hook with a configurable interval and guaranteed cleanup replaces the scattered `setInterval`/`setTimeout`.
- **Log streaming:** Client-side cap to the last N lines, throttled append (animation frame/interval), uncontrolled `textarea` via ref. Reusable SSE frame parser that buffers incomplete frames; applies to pod logs, build logs, and pod status.
- **Tab navigation:** Tab/section state client-side; URL sync via `replaceState`/shallow instead of server navigation. Inactive tabs stay unmounted.
- **Queries:** Introduce lean read variants (only required fields or `_count`) for the app list/breadcrumbs and projects/sidebar; the full model stays for the detail view. Cache tags/invalidation stay unchanged.
- **Deployment status:** One server-side watch over deployments that clients attach to as subscribers; fan-out of events. Initial status via a deployment lookup map.
- **No schema changes** and no change to domain display rules; purely performance behavior.

## Testing Decisions

- A good test checks **external behavior**, not implementation details (no asserts on internal counters/private state).
- **Services:** Unit tests analogous to the existing `*.unit.spec.ts` (e.g. monitoring service). Proof: Kubernetes client/pod-service calls no longer scale linearly, lookup maps return correct assignments.
- **Utilities:** Pure unit tests for the SSE frame buffer (split frames, multiple frames per chunk) and the log buffer (cap, order).
- **UI:** React Testing Library — e.g. the pod-status indicator does not re-render when another app changes; the poller pauses on `document.hidden`; unmount leaves no timers behind (with fake timers).
- **Measurable acceptance:** number of Kubernetes calls, RSC payload size, re-render count, open timers after unmount.
- Prior art: `src/server/services/*.unit.spec.ts`, `src/frontend/utils/*.unit.spec.ts`, `src/app/project/[projectId]/app-components/project-network-graph.spec.ts`.

## Out of Scope

- Findings 7–11 and 14–16 of the analysis (SimpleDataTable search index/mutation, network-graph memoization, inline column arrays, table virtualization, duplicate toast error handling, sidebar lookup, redundant deployment-status state).
- Changes to the database schema or domain rules.
- New features (table virtualization, filter redesign, caching framework).
- Backend architecture changes beyond the shared deployment watch.

## Further Notes

- The full analysis with source locations is in the chat; findings 1–6, 12, 13 map 1:1 to the issues.
- Ordering and blocking edges: see `issues/`.
- Acceptance must be shown measurably (K8s call counts, re-renders, payload, timer cleanup), not just "feels faster".
