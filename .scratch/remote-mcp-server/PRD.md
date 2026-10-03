# Remote MCP Server for QuickStack

Status: ready-for-agent

## Problem Statement

QuickStack exposes a REST API under `/api/v1` that a **REST API Client** can drive with a **REST API Key**. Users who work through AI hosts (Claude Code, Cursor, VS Code) currently have no way to let an agent read or change QuickStack state. Those hosts speak the Model Context Protocol (MCP), not the QuickStack REST API.

A naive MCP bridge would expose one tool per REST endpoint. The API already has roughly two dozen endpoints across Projects, Apps, Agents, and Agent Sandboxes. Loading two dozen tool definitions into the model's context before the conversation starts is expensive and makes the model slower and less accurate. A second naive approach would re-declare every input and output schema as MCP tool definitions, duplicating schemas that already exist and drifting from the REST API over time.

QuickStack needs a remote MCP endpoint that mirrors the existing REST API actions, reuses existing schemas and handlers instead of duplicating them, and keeps the number of tools the model must load extremely small.

## Solution

Add a remote MCP endpoint to QuickStack that is generated from the existing REST routes.

The server inspects the existing Elysia REST route definitions at startup and builds an **operation catalog** from their already-declared metadata: `detail.operationId`, `detail.summary`, `detail.tags`, and the `params`, `query`, `body`, and success-response schemas. It then exposes exactly two MCP tools:

1. **`search_operations`** - the model discovers available operations on demand. It supports a free-text `search` term and a `detail` level (`name`, `summary`, `full`) so the model can progressively pull in only the information it needs.
2. **`execute_operation`** - the model names an operation and supplies arguments. The server translates the call into an internal request against the existing Elysia app, so validation, the **Shared Authorization Check**, error mapping, and business logic run exactly as they do for the REST API.

Because execution goes through the existing app, a new REST route automatically becomes an available operation with no additional MCP code. Authentication reuses the existing **REST API Key** logic: the MCP client sends the same bearer credential it would send to the REST API.

This keeps the MCP surface tiny (two tools), avoids schema duplication, and preserves a single source of truth for QuickStack operations.

## User Stories

1. As a QuickStack administrator, I want a remote MCP endpoint under the QuickStack origin, so that AI hosts can connect to QuickStack without me deploying a separate service.
2. As a QuickStack administrator, I want the MCP endpoint to authenticate with an existing **REST API Key**, so that I do not have to stand up a new identity provider.
3. As a QuickStack administrator, I want MCP access to honor exactly the same permissions as the REST API, so that an agent cannot do more than the owning user can.
4. As a QuickStack administrator, I want an invalid or expired **REST API Key** to be rejected before any operation runs, so that unauthenticated requests fail fast.
5. As a QuickStack user, I want to create a **REST API Key** for my MCP client, so that I can connect an AI host on my behalf.
6. As a QuickStack user, I want the MCP client to present its **REST API Key** as a bearer credential, so that configuration matches the REST API I already use.
7. As an agent, I want `tools/list` to return a very small, fixed set of tools, so that connecting to QuickStack does not consume large amounts of context.
8. As an agent, I want a `search_operations` tool, so that I can discover what QuickStack can do without loading every operation definition.
9. As an agent, I want `search_operations` to match on operation identifier, summary, and tags, so that I can find the relevant operation with a natural query.
10. As an agent, I want `search_operations` to support a `name` detail level, so that I can browse cheaply when context is tight.
11. As an agent, I want `search_operations` to support a `summary` detail level, so that I can see method, path, and description without full schemas.
12. As an agent, I want `search_operations` to support a `full` detail level, so that I can fetch the exact input and output schema for the operation I have chosen.
13. As an agent, I want operation results to be deterministic in order, so that repeated discovery produces stable output and prompt caching can work.
14. As an agent, I want to execute an operation by its identifier, so that I do not need a distinct tool per endpoint.
15. As an agent, I want `execute_operation` to accept path parameters, query parameters, and a request body as separate fields, so that the mapping back to the REST route is unambiguous.
16. As an agent, I want `execute_operation` to return the operation result as structured content plus a human-readable text mirror, so that I can both parse and read the result.
17. As an agent, I want a successful operation to return the **Direct Success Payload** from the REST API, so that MCP output matches REST output.
18. As an agent, I want a failed operation to return an actionable tool error message, so that I can correct my arguments and retry.
19. As an agent, I want a **Problem Details Error** from the REST API to be surfaced as an MCP tool error rather than a transport failure, so that the model can read the reason.
20. As an agent, I want an unknown operation identifier to produce an actionable error listing no such operation, so that I do not loop on a typo.
21. As an agent, I want an operation whose input fails validation to return a validation message, so that I can fix the payload.
22. As an agent, I want to list **Projects**, so that I can present and choose a project.
23. As an agent, I want to get a single **Project**, so that I can inspect its details.
24. As an agent, I want to create or update a **Project**, so that I can set up a workspace in QuickStack.
25. As an agent, I want to delete a **Project**, so that I can clean up when authorized.
26. As an agent, I want to list **Apps**, optionally filtered by **Project**, so that I can reason about an **App Project**.
27. As an agent, I want to get a single **App**, so that I can inspect its configuration.
28. As an agent, I want to create or update an **App** using **POST Upsert**, so that the write semantics match the REST API.
29. As an agent, I want to receive the same **Full Schema Write** validation as REST when saving an **App**, so that MCP writes cannot produce invalid state.
30. As an agent, I want to delete an **App**, so that I can remove a workload when authorized.
31. As an agent, I want to trigger a **Build-And-Deploy Action** for an **App**, so that I can ship a new build.
32. As an agent, I want to list an **App**'s deployments and read a deployment's logs, so that I can diagnose a rollout.
33. As an agent, I want to read the current logs of an **App**, so that I can debug a running workload.
34. As an agent, I want to list **Agents**, optionally filtered by **Project**, so that I can reason about an **Agent Project**.
35. As an agent, I want to get, create, update, and delete an **Agent**, so that I can manage agent definitions.
36. As an agent, I want to trigger a **Deploy (Agent)**, so that I can reconcile an **Agent** configuration to Kubernetes.
37. As an agent, I want to list, start, get, and stop **Agent Sandboxes**, so that I can manage running instances of an **Agent**.
38. As an agent, I want to run a shell command in an **Agent Sandbox**, so that I can drive an agent workspace.
39. As a QuickStack maintainer, I want a new REST route to appear as an operation automatically, so that I do not write MCP code per endpoint.
40. As a QuickStack maintainer, I want input and output schemas to come from the existing route definitions, so that MCP can never drift from REST.
41. As a QuickStack maintainer, I want the MCP endpoint to live inside the existing Next.js application, so that no new deployment target or custom server change is required.
42. As a QuickStack maintainer, I want the MCP endpoint to reject requests with an unexpected Host or Origin, so that DNS-rebinding attacks cannot reach it.
43. As a QuickStack maintainer, I want the API key never to be logged, echoed, or embedded in tool results, so that credentials cannot leak into model context or logs.
44. As a QuickStack maintainer, I want binary and streaming operations excluded from the catalog in the first version, so that the JSON-based tool contract stays well defined.
45. As a QuickStack maintainer, I want operation catalog caching to be user-scoped, so that one user's operation list is never served to another.
46. As a QuickStack maintainer, I want the MCP endpoint to be stateless per request, so that it scales behind the existing load balancer without sticky sessions.
47. As a QuickStack maintainer, I want the MCP implementation to target the current MCP specification revision, so that it works with modern hosts without deprecated transports.
48. As a QuickStack maintainer, I want the MCP endpoint to work as a web-standard request handler, so that it composes with the existing Next.js routing without adapters.
49. As a QuickStack maintainer, I want tests to exercise the MCP endpoint through its HTTP handler, so that tests assert external behavior instead of internals.

## Implementation Decisions

### Target specification and SDK

- Target the current MCP specification revision (`2026-07-28`) using the stable v2 TypeScript SDK package `@modelcontextprotocol/server`.
- Use `createMcpHandler(factory)` to produce a web-standard `(Request) => Promise<Response>` handler, and `McpServer.registerTool(...)` to register tools.
- Mount the handler as a Next.js route handler that exports the web-standard verb functions, so no custom-server change is needed. The route is dynamic and must not be statically optimized.

### Operation catalog derived from existing routes

- Build the catalog by introspecting the existing Elysia REST app's route table. Each `InternalRoute` exposes `method`, `path`, and `hooks`. The hooks hold `body`, `query`, `params`, `response`, and `detail`.
- For each route, derive:
  - `operationId` from `hooks.detail.operationId` (every REST route already declares one).
  - `summary` and `description` from `hooks.detail.summary` / `hooks.detail.description`.
  - `tags` from `hooks.detail.tags`.
  - `method` and `path` from the route.
  - Input schema by merging `hooks.params`, `hooks.query`, and `hooks.body` into one JSON object schema, tracking the origin (`pathParams`, `query`, or `body`) of each property so `execute_operation` can split arguments back apart.
  - Output schema from the 200 response schema in `hooks.response`, reusing the existing date-to-string mapping used for REST response models.
- Convert schemas to JSON Schema 2020-12 with the same conversion the OpenAPI plugin already uses for these Zod schemas.
- Fallback decision: if Elysia does not expose raw schemas at runtime, consume the already-generated OpenAPI document as the schema source and keep `app.handle` for execution. The introspection path is preferred because it does not depend on the OpenAPI feature flag.
- The catalog is a pure function of the Elysia app: no per-endpoint code. New REST routes appear automatically.

### The two tools

`search_operations`:

```ts
inputSchema: z.object({
    search: z.string().optional(),                                  // match operationId, summary, tags
    detail: z.enum(['name', 'summary', 'full']).default('summary')
})
outputSchema: z.object({
    operations: z.array(z.object({
        operationId: z.string(),
        method: z.string(),
        path: z.string(),
        summary: z.string().optional(),
        tags: z.array(z.string()),
        inputSchema: z.unknown().optional(),                        // only at `full`
        outputSchema: z.unknown().optional()                        // only at `full`
    }))
})
```

`execute_operation`:

```ts
inputSchema: z.object({
    operationId: z.string(),
    pathParams: z.record(z.unknown()).default({}),
    query: z.record(z.unknown()).default({}),
    body: z.unknown().optional()
})
outputSchema: z.object({
    status: z.number().int(),
    result: z.unknown()
})
```

- `search_operations` is annotated read-only and idempotent. `execute_operation` is not read-only.
- Tool names are namespaced with a `quickstack_` prefix or equivalent to avoid collisions when a host connects several servers.
- Descriptions are written for an agent: they explain what QuickStack is, when to search first, and that arguments map to the REST route fields.

### Execution and reuse

- `execute_operation` resolves the `operationId` against the catalog. An unknown identifier is an MCP tool error, never a 500.
- The executor substitutes `pathParams` into the path template, appends `query` as a query string, and serializes `body` as JSON.
- The executor dispatches through the existing Elysia app's `handle(request)` method. This reuses parsing, validation, the **Shared Authorization Check**, the central error mapper, and all business logic.
- Only catalog entries may be executed. The path template is server-owned, so a caller cannot inject an arbitrary path.
- The bearer credential from the MCP request is forwarded to the internal request so the existing authentication derives the same **REST API Client** identity.
- Binary and streaming routes (file read/write, any octet-stream response) are marked unsupported in the catalog and return an actionable tool error instead of being executed in the first version.

### Authentication

- Authenticate the MCP endpoint with the existing **REST API Key** logic. Reuse the helper that resolves a bearer header to a requester identity; do not introduce a second credential type.
- A missing, malformed, or invalid key returns 401 before any tool runs.
- The verified identity is passed to the MCP handler as pass-through auth info; tool handlers read the raw token from it to build the internal request.
- Known tradeoff: the key is resolved once at the MCP gate and again by the REST derivation. Accept the duplicate lookup in the first version; it is stateless and simple. A later optimization may hand the resolved identity across the boundary.

### Response shaping and caching

- `search_operations` and `tools/list` output is deterministic and sorted by `operationId`.
- The operation list is user-scoped, so its cache scope is private.
- The server is stateless per request; the handler may be run behind the existing load balancer without sticky sessions.

### Security

- Validate Host and Origin in front of the handler and reject mismatches with 403.
- Never include the API key in tool output, errors, or logs.
- Validate `execute_operation` input against the derived JSON schema before dispatch; the Elysia layer validates again.
- Do not enable model-controlled headers or arbitrary URL routing.

### Module responsibilities (interfaces, not paths)

- **Operation registry**: given an Elysia app, return an ordered list of operation descriptors. Pure and side-effect free.
- **Operation executor**: given a descriptor and arguments, build and dispatch the internal request through the app; map the response to a tool result.
- **MCP auth gate**: given a web-standard request, return a verified identity or a 401 response.
- **MCP server factory**: build an `McpServer` for one request, registering the two tools with schemas and handlers.
- **MCP HTTP route**: compose host/origin validation, the auth gate, and the web-standard handler.

### Architectural alignment

- Reuses the single source of truth for operations (the REST routes) and the single authorization path (`shared-authorization.utils`).
- Does not change REST behavior, schemas, or error contract.
- No conflict with existing ADRs. Operations that perform **Full Schema Write** are forwarded unchanged; the MCP layer adds no alternate write semantics.

## Testing Decisions

What makes a good test here: exercise the MCP endpoint as a black box over JSON-RPC. Construct a web-standard request, send `tools/list` and `tools/call`, and assert the JSON-RPC response. Do not assert registry internals, private helpers, or the exact wording of derived schemas beyond what a client observes. Test only external behavior.

Highest seam: the **MCP server factory** accepts the source Elysia app and the auth resolver as inputs. Tests build the handler from a small fixture Elysia app that uses the same route idioms (Zod `params`/`query`/`body`, `detail.operationId`, `detail.summary`, response model) and the same authentication derivation, with services mocked. They then call `handler.fetch(request)` and assert results. This is one new seam; it reuses the existing `app.handle` seam underneath. Aim to keep the codebase at this single new seam.

Existing seam reused: the Elysia app's `handle(request)` method, already used by the existing route unit test.

Modules to test:

- Operation registry, through the MCP handler (`tools/list` shape, determinism, search filtering, detail levels).
- MCP auth gate (missing/invalid/valid **REST API Key**).
- Operation executor, through the MCP handler (success, validation failure, not-found, unknown operation, binary route rejection).
- MCP server factory, through the MCP handler (tool registration and schemas).
- Host/Origin validation in front of the handler.

Prior art:

- The existing agent sandbox route unit test drives routes with `app.handle(new Request(...))` and mocks services with `vi.mock`, which is the model for handler-level tests.
- Unit tests live next to source as `*.unit.spec.ts` and run under the Vitest `jsdom` project; integration tests live under `src/__tests__/integration/` and run under the `node-integration` project.

## Out of Scope

- OAuth 2.1 resource-server authentication with an external identity provider, protected-resource metadata, and audience validation.
- Local stdio transport, desktop bundle packaging, and publishing to an MCP registry.
- Binary and streaming operations (file read/write, octet-stream responses) in the first version.
- Per-operation scopes, step-up authorization, and operation-specific named tools.
- `x-mcp-header` parameter mirroring and gateway header routing.
- MCP resources, resource templates, prompts, and MCP Apps user interfaces.
- Changing any REST API route, schema, authorization rule, or error contract.
- Server-side state, sessions, and long-lived change subscriptions.

## Further Notes

- Variant context: four approaches were considered. (A) a generic OpenAPI-to-MCP bridge; (B) an off-the-shelf Elysia MCP adapter; (C) this in-house route adapter on the v2 SDK; (D) hand-written curated tools on the v2 SDK. This spec selects C because it targets the current specification, keeps a tiny external surface, and maximizes reuse of existing routes and services. D remains a possible later step if curated, task-oriented tools prove valuable; B was rejected because available adapters target the older v1 SDK and expose one tool per route; A was rejected because it mirrors the API one tool per endpoint and requires the OpenAPI feature flag.
- Context-efficiency rationale: Anthropic's "Code execution with MCP" guidance recommends exposing a `search_tools`-style meta-tool with a detail level and loading definitions on demand; a representative example reduced token usage from roughly 150,000 to 2,000. This design applies that pattern with two tools.
- Assumption to verify early: the exact runtime shape of Elysia route `hooks` for Zod schemas. If raw schemas are unavailable, fall back to the generated OpenAPI document as described in the implementation decisions.
- Domain vocabulary used throughout: **Project**, **App**, **Agent**, **Agent Sandbox**, **Project Workload**, **REST API Key**, **REST API Client**, **Shared Authorization Check**, **Build-And-Deploy Action**, **Deploy (Agent)**, **Direct Success Payload**, **Problem Details Error**, **POST Upsert**, **Full Schema Write**.
