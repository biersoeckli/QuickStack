# MCP evaluation and Inspector smoke test

QuickStack exposes the REST API over MCP through `/api/mcp`. Two checks keep that
surface honest:

- `scripts/mcp-eval.mjs` measures agent success rate, tool calls, errors, token
  usage and latency against a live endpoint.
- The official [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
  connects to the endpoint as an independent client and verifies the protocol
  handshake, tool list and one representative call.

## Prerequisites

- A running QuickStack instance with the MCP canary active and the MCP server
  set to **Read only** or **Read & write** in Settings → Developer → MCP.
- Secret fields are redacted from MCP responses unless **Send secrets in MCP
  responses** is enabled. Scripted and LLM evals should normally run with
  redaction enabled.
- A REST API key from Settings → Account & Access → API Keys.
- Node.js 24 (uses the built-in `fetch` and `parseArgs`).

```sh
export MCP_URL="http://localhost:3000/api/mcp"
export MCP_API_KEY="<rest-api-key>"
```

## Evaluation harness

The harness talks raw JSON-RPC to the MCP endpoint, so it does not depend on an
LLM SDK. It runs the same tasks in two modes.

### Scripted mode

Deterministic calls that smoke-test the endpoint contract: schema discovery,
listing, pagination and optional reads. No model and no tokens are involved.

```sh
yarn mcp:eval
```

This mode answers "does the MCP endpoint still expose the expected operations
and schemas?" It is the right check for CI.

### LLM mode

An OpenAI-compatible model receives the real MCP tool definitions and solves the
same tasks through the documented workflow: `quickstack_search_operations` →
`detail: "full"` schema → `quickstack_execute_read_operation` or
`quickstack_execute_operation`.

```sh
EVAL_LLM_BASE_URL="https://api.openai.com/v1" \
EVAL_LLM_API_KEY="<llm-api-key>" \
EVAL_LLM_MODEL="gpt-4o-mini" \
yarn mcp:eval --mode llm
```

`EVAL_LLM_BASE_URL` is any OpenAI-compatible base URL, for example a LiteLLM
gateway. The harness sends `temperature: 0` and stops each task after
`--max-steps` tool iterations (default 8).

This mode answers "can an agent actually finish the task with the tools as
described?" It measures what the scripted mode cannot: tool selection, schema
reading and argument construction.

### Optional tasks

| Variable | Effect |
| --- | --- |
| `MCP_EVAL_APP_ID` | Adds a task that reads the last 50 log lines of that app. |
| `MCP_EVAL_AGENT_ID` | Adds a task that lists at most 5 sandboxes of that agent. |
| `MCP_EVAL_ALLOW_WRITES=1` | Adds a create-project task. The task needs an admin API key; the harness deletes the created project afterwards. |

```sh
MCP_EVAL_APP_ID="<app-id>" MCP_EVAL_AGENT_ID="<agent-id>" yarn mcp:eval
MCP_EVAL_ALLOW_WRITES=1 yarn mcp:eval --mode llm
```

### Report

`--json` prints the full report for dashboards or regression tracking. The text
report looks like this:

```text
QuickStack MCP evaluation (llm)
URL: http://localhost:3000/api/mcp
Server: quickstack 0.1.0 protocol=2026-07-28 instructions=true

Success: 4/5 tasks (80.0%)
Tool calls: 11 (1 errors, 9.1%)
Tokens: 9120 in / 640 out = 9760 total
Duration: 18.4s

  PASSED find-deploy-operation calls=1 errors=0 820ms tokens=610
  PASSED list-projects calls=2 errors=0 1200ms tokens=1340
  FAILED paginate-projects calls=2 errors=1 1500ms tokens=1580
         error in listProjects: QuickStack returned HTTP 422: ...
```

Metrics:

| Metric | Meaning |
| --- | --- |
| `successRate` | Tasks whose verification predicate passed. |
| `toolCalls` | MCP `tools/call` requests sent, including failed calls. |
| `toolErrors` | Calls that returned `isError: true` or failed at the transport level. |
| `inputTokens` / `outputTokens` | Sum of the model's `usage` fields across steps. |
| `avgToolCallsPerTask` | Tool calls divided by tasks, a rough efficiency signal. |
| `durationMs` | Wall-clock time for the whole run. |

Exit code is `1` when a task fails or no task ran, so the harness can gate CI.
Tool errors are reported even when a later retry still completes the task; use
the error rate to catch descriptions that provoke wrong calls.

### Adding a task

Tasks live in `readOnlyTasks()` and `writeTasks()` inside
`scripts/mcp-eval.mjs`. A task needs:

- `id` and `goal` (the goal is the prompt in LLM mode),
- `script` (the deterministic calls for scripted mode),
- `verify({ calls })` (return `true` only when the task outcome is correct),
- optional `cleanup(client, calls)`.

`calls` entries contain `tool` (`search`, `read`, `write`), `args`, `result`,
`isError` and `durationMs`. Use `executedResult(call)` to read the REST payload
from a tool response and `searchOperations(calls)` to inspect discovery output.

## MCP Inspector

MCP Inspector is an independent client. It verifies that the endpoint works for
a real MCP host, not only for the project's own harness.

Pin the Inspector version in CI (`@2.12.0` at the time of writing) so a later
release cannot change the result.

### Handshake and tool list

```sh
npx --yes @modelcontextprotocol/inspector@2.12.0 --cli \
  --transport http \
  --server-url "$MCP_URL" \
  --header "Authorization: Bearer $MCP_API_KEY" \
  --method initialize \
  --format json

npx --yes @modelcontextprotocol/inspector@2.12.0 --cli \
  --transport http \
  --server-url "$MCP_URL" \
  --header "Authorization: Bearer $MCP_API_KEY" \
  --method tools/list \
  --format json
```

### Representative call

The read tool is safe to call repeatedly:

```sh
npx --yes @modelcontextprotocol/inspector@2.12.0 --cli \
  --transport http \
  --server-url "$MCP_URL" \
  --header "Authorization: Bearer $MCP_API_KEY" \
  --method tools/call \
  --tool-name quickstack_execute_read_operation \
  --tool-args-json '{"operationId":"listProjects"}' \
  --format json
```

A healthy `tools/call` exits `0` and includes
`.result.structuredContent.result` in the JSON envelope. Exit `5` means the tool
returned `isError: true`; exit `3` means the endpoint rejected the API key.

### Web UI

```sh
npx --yes @modelcontextprotocol/inspector@2.12.0
```

Use transport `HTTP`, the endpoint URL and an `Authorization: Bearer <key>`
header. The Tools tab lists the three namespaced tools and lets you inspect their
input schemas.

### Notes

- The endpoint is stateless and only accepts `POST`. `GET` and `DELETE` return
  `405 Method Not Allowed`.
- The server validates the `Origin` header for browser requests. The Inspector
  CLI and web UI are not browsers and do not send a foreign `Origin`.
- Do not pass the API key in the URL. The Inspector redacts configured headers
  but not credentials embedded in a URL.
