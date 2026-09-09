# Structured Log Viewer

Status: `ready-for-agent`

## Problem Statement

Today log output in QuickStack is rendered as a plain, read-only text area. The stream is appended to one string, and the browser is scrolled to the bottom on every chunk. That works for a quick peek, but once a stream is long — nginx access lines mixed with container boot messages, or a multi-step deployment stream — the user cannot tell signal from noise:

- Every line looks the same. There is no visual difference between a boot notice, an HTTP 200, a warning, and a failure.
- It is impossible to filter, e.g. "show me only errors", or to search for one phrase in a long deployment run.
- ANSI colour codes produced by tools in the container are shown as raw escape garbage, not as colours.
- There is no way to pause a busy live stream to read it, or to copy / download the visible output.

Comparable PaaS products (Railway's service logs, Render's build and runtime logs) render logs as structured, filterable, searchable live feeds while still streaming new lines in real time. QuickStack should match that bar.

## Solution

Replace the two plain-text stream components (app/pod runtime logs and deployment/build logs) with a single reusable, line-based **Log Viewer**. The stream behaviour is preserved: lines still arrive live over the existing SSE endpoints and are appended as they stream. But the viewer now

- splits the raw stream into lines and shows each line as its own row;
- parses a leading timestamp out of each line and displays it dimmed;
- classifies each line into a log level (`error`, `warning`, `success`, `info`, `debug`) and signals the level with colour and a small marker;
- lets the user filter by level (e.g. only `error` + `warning`), search with highlighting, and hide timestamps;
- pauses/resumes a live stream, buffering arrivals while paused and flushing them on resume;
- follows the newest line automatically, but stops following as soon as the user scrolls up;
- renders ANSI colour codes instead of leaking escape sequences;
- caps the buffered history to a bounded tail so memory and DOM stay predictable;
- offers copy-to-clipboard and download of the visible log.

Both current consumers (runtime logs and build logs) are served by this one viewer; each consumer only differs by which SSE stream it connects to and what parameters it sends.

## User Stories

1. As a user viewing an App's runtime logs, I want every log entry on its own row so that I can scan the output line by line.
2. As a user viewing runtime logs, I want the timestamp that the stream already carries to be shown dimmed and separated from the message so that I can correlate entries with time.
3. As a user viewing build logs, I want the `[<timestamp>]:` prefix that build steps already carry to be recognised as the row timestamp so that build lines look consistent with runtime lines.
4. As a user, I want each row coloured by severity so that errors, warnings, successes, and plain info are visually distinct at a glance.
5. As a user, I want a level filter (All / Error / Warning / Success / Info / Debug) so that I can narrow a noisy stream to what matters, e.g. only errors.
6. As a user, I want the level filter to allow multiple levels at once so that I can see, say, errors and warnings together.
7. As a user, I want to search the visible log and have non-matching lines hidden so that I can find a specific phrase in a long run.
8. As a user, I want the search match to be highlighted inside a matching line so that I can see where the phrase occurs.
9. As a user, I want the new live lines to still stream in and appear at the bottom so that I keep the current live experience while filters are inactive.
10. As a user, I want the view to auto-scroll to the newest line while I am at the bottom so that I can watch a deployment progress hands-free.
11. As a user, I want auto-scroll to stop the moment I scroll up so that I can read an earlier passage without being yanked down.
12. As a user, I want an obvious way to jump back to the live tail after I have scrolled up so that I can resume following.
13. As a user, I want to pause a busy live stream so that I can read the output at my own pace.
14. As a user, I want lines that arrive while paused to be buffered and replayed in order when I resume so that I do not lose output.
15. As a user, I want to see how many lines are buffered while paused so that I know how far behind the live tail I am.
16. As a user, I want the stream to keep following (staying connected) when only level/search filters change so that live output is not interrupted by filtering.
17. As a user, I want to copy the visible log to my clipboard so that I can paste it into an issue or chat.
18. As a user, I want to download the visible log as a text file so that I can keep it for later analysis.
19. As a user, I want to hide the timestamp column so that I can see more message text on narrow dialogs.
20. As a user, I want ANSI colour codes to render as colours so that coloured build tools are readable instead of showing escape garbage.
21. As a user, I want the connection status indicator (live / disconnected) to be kept so that I know whether I am watching a live tail or a finished stream.
22. As a user viewing a long stream, I want history bounded to a configurable tail (e.g. 100 / 500 / 1000 lines) so that the page stays responsive on heavy output.
23. As a user, I want clear empty/loading/ended states ("waiting for logs", "no logs found", "stream closed") so that I understand why nothing is printed.
24. As a user on an App overview, I want to open the same structured viewer for both the deployment logs and the runtime logs of that App so that my mental model is consistent.
25. As an Agent owner, I want runtime log output to keep working through the existing terminal flow unchanged so that interactive sessions are not affected by this redesign.
26. As a developer, I want the log parsing and level classification to live in pure, unit-tested functions so that behaviour on real-world lines is pinned down without a browser.

## Implementation Decisions

### A shared stream layer

A single client-side reader abstracts the two existing SSE POST endpoints. It takes a "stream source" descriptor (endpoint + body), decodes the body, splits it into complete lines, and exposes: a callback per complete line, an end/error callback, and an abort handle. Both current routes are POST + `ReadableStream`; the reader issues the fetch, owns the `AbortController`, and the component re-runs it whenever the source descriptor or the tail size changes.

The two existing consumers become thin "source" configurations over this one reader — one for runtime logs (namespace + pod), one for build logs (deployment). No new server endpoints are introduced.

### A line aggregator (pure)

Chunk boundaries rarely align with line boundaries. Keep a small pure function that ingests a raw chunk plus the previous partial remainder and returns the complete lines ended by `\n` plus the new remainder. This keeps line splitting deterministic and testable instead of being tangled into the streaming effect.

### Log-line model and parser (pure)

Each complete line becomes a log entry: a timestamp (nullable), a message, and the raw text. Parsing is driven by the two known shapes, plus a fallback:

- Runtime (pod) lines may carry a leading container-runtime RFC3339Nano timestamp such as `2026-09-07T14:54:19.801049087Z `; when present it is stripped into the timestamp and the remainder is the message. Many messages then contain their own secondary timestamp (e.g. nginx `2026/09/07 14:54:19 [notice] ...`) which stays part of the message.
- Build lines may carry a leading `[<ISO-timestamp>]:` prefix (plus banner blocks of `---` lines and `Deployment:`/`App:`/`Project:` headers); the bracketed prefix becomes the timestamp.
- Anything that does not match either shape is kept whole as a message with no timestamp.

The parser must never drop content: unknown lines and multiline fragments still render verbatim, just without timestamp extraction.

### Level classifier (pure, heuristic)

Each message maps to one of `error | warning | success | info | debug`. The classifier is deliberately conservative and ordered:

1. Explicit structured markers win first: bracketed tags (`[error]`, `[warn]`, `[notice]`, `[info]`, `[event/Failed]`, `[event/Pulled]`, `[event/Started]`, ...), `level=`-style key/value markers, JSON `{"level": ...}`-style markers, and obvious prefixes such as `error:`, `ERR`, `fatal`.
2. HTTP access lines classify by status code: 5xx -> error, 4xx -> warning, 2xx/3xx -> info.
3. Well-known phrasing then falls back: nginx `[notice]`, "Configuration complete", "ready for start up" -> info/success.
4. Everything else defaults to `info`.

Unrecognised lines default to `info` so the default view (All levels) never hides anything; a wrong classification only ever matters when the user actively filters. The classification vocabulary is data (a table of patterns) so the sample lines captured in this issue can be added as fixture cases.

### ANSI handling

Colour escape sequences are interpreted for display only. Classification runs on the message with ANSI control sequences stripped, so escape noise never influences level detection.

### Viewer component

One composed component renders the toolbar, the scrolling log surface, and the status area. It owns the interaction state:

- Level filter: multi-select of levels; empty selection means "All". Changing it filters the in-memory tail only; the live stream keeps flowing.
- Search: text filter with "grep" semantics (only lines containing the term are shown) plus highlight of the term inside each matching line.
- Follow / pause: while at the bottom the list follows new lines; scrolling away from the bottom stops following and shows a "jump to live" affordance. An explicit pause stops appending to the visible history and buffers arrivals; resume replays the buffer in order and shows a buffered-count hint while paused.
- Toolbar actions: copy visible lines, download visible lines as `.log`/`.txt`, toggle timestamps, choose tail size (100 / 500 / 1000).
- Tail ring buffer: history is capped at the chosen tail; the oldest lines drop when the cap is exceeded. Runtime streams already request a matching `linesCount` server-side; build streams are capped client-side by the same ring. A tail of 500 default, max 1000, deliberately avoids needing a virtualization dependency for v1.
- Rendering batching: chunk arrivals coalesce (one render per flush) rather than a state update per decoded chunk, so a bursty stream does not thrash React.

### Row visual design

Each row: a thin level-colour strip on the left edge and a subtle level-tinted background for `error`/`warning`; the parsed timestamp in dimmed, fixed-width monospace; the message in monospace that wraps long lines (`break-all`, preserved whitespace) and renders ANSI colours. Rows use the same Source Code Pro face already used by the current log text. The whole surface sits on the existing dark `slate-900`-style box used today, keeps the connection dot with its hover tooltip, and fits the existing dialog widths.

### End states

Distinct states for: connecting/loading ("waiting for first log line"), connected live, ended by stream close ("log stream closed"), and empty after close ("no logs found"). Errors during streaming are surfaced inline without killing the whole dialog.

## Testing Decisions

What makes a good test here: feed real-world lines and assert what the user actually experiences — a line's extracted timestamp, its message, and its level — plus that chunk boundaries never corrupt a line. No DOM, no streaming, no server is involved; everything lives in the pure utilities.

- The line aggregator (chunk -> complete lines + remainder) is unit-tested with chunks that cut lines mid-way, including a line split across three chunks and trailing `\r` handling.
- The parser is unit-tested against the captured sample corpus: runtime nginx boot lines with RFC3339Nano prefixes, runtime HTTP access lines, build banner blocks, and build step lines with `[ISO]:` prefixes.
- The classifier is unit-tested table-driven: one fixture line per expected level, drawn from real output (nginx `[notice]` -> info, "ready for start up" -> info, HTTP 404 access -> warning, `[event/Started]` -> success, `error:`/`fatal` -> error) plus the guarantee that unknown lines default to `info` and are never dropped.
- Prior art for all of the above is the existing co-located utility unit specs (`*.unit.spec.ts`) next to shared/frontend utils in this repo.
- The composed viewer component, its toolbar interactions, and the SSE wiring have no existing test seam in this repo and stay covered by manual QA, matching current practice.

## Out of Scope

- The interactive exec terminal flow (start `sh`/`bash`/opencode sessions) is untouched; this redesign covers log *viewing* only.
- Server-side filtering, log persistence, log storage, or time-range queries. History is the in-memory tail only.
- Automatic reconnect/retry when the SSE connection drops.
- Adding a virtualization dependency; bounded tail renders keep the DOM small for v1.
- Log export formats beyond plain-text download, multi-container log selection, and log analysis/AI features.
- A guarantee of perfect level classification on arbitrary third-party log formats; behaviour is best-effort heuristics with a safe `info` default.
- Changes to the SSE route contracts or payload shapes.

## Further Notes

- The reference experience is the live, filterable log view used by Railway (service logs) and Render (build/runtime logs): keep the raw terminal look and the live follow, but add structure so long streams are navigable.
- Observed real streams used as acceptance fixtures:

  - Runtime boot lines such as `2026-09-07T14:54:19.801049087Z /docker-entrypoint.sh: Configuration complete; ready for start up`
  - nginx lines such as `2026-09-07T14:54:19.853262106Z 2026/09/07 14:54:19 [notice] 1#1: start worker process 29`
  - HTTP access lines such as `2026-09-08T08:22:52.515406473Z 10.42.9.142 - - [08/Sep/2026:08:22:52 +0000] "GET / HTTP/1.1" 200 22694 "-" ...`
  - Build lines such as `[2026-09-07T14:54:18.254Z]: Starting deployment of containter...` and `[2026-09-07T14:54:19.735Z]: [event/Created]: Created container: ...`
- The existing "Stream opened, loading ..." and "[INFO] Log stream closed by Pod." framing lines are transport noise; they should be surfaced as status (loading / closed) rather than as data rows.
