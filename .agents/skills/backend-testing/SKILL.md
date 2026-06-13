---
name: backend-testing
description: Create and review QuickStack backend unit and integration tests using the project's Vitest, Prisma, SQLite, and k3s conventions. Use when editing backend test files under `src/server/`, `src/shared/`, or `src/__tests__/integration/`, or when the user asks for backend test coverage, mocks, Prisma test DB setup, or Kubernetes integration tests.
---

# Backend Testing

## Quick Start

Use these defaults for QuickStack backend tests:

- Name unit tests `*.unit.spec.ts`.
- Name integration tests `*.integration.spec.ts`.
- Keep unit tests beside the source file.
- Put integration tests in `src/__tests__/integration/` mirroring the source path.
- Use Vitest globals without importing `describe`, `it`, `expect`, or `vi`.
- Prefer `@/...` imports for app modules.

## Workflow

When creating or updating backend tests:

1. Pick the right test type: unit, Prisma/SQLite integration, or k3s integration.
2. Place the file in the correct location and use the required filename suffix.
3. For unit tests, mock all external dependencies and keep the suite isolated.
4. For Prisma integration tests, use `createPrismaTestContext('label')`.
5. For k3s integration tests, use `createK3sTestContext()` and mock the Kubernetes adapter before imports.
6. Run the smallest relevant test command first, then broaden if needed.

## Unit Tests

- Mock Prisma, Kubernetes, S3, Longhorn, filesystem, network calls, and singleton services.
- Use `vi.mock()` and `vi.mocked()` for typed mocks.
- Use `vi.importActual()` for partial mocks when needed.
- If a module initializes from environment variables at import time, set env first and call `vi.resetModules()` before importing it.
- Do not hit the real database, filesystem, or Kubernetes from unit tests.

## Integration Tests

- Use a real temporary SQLite database file instead of mocks.
- Use `createPrismaTestContext()` for DB lifecycle setup and teardown.
- Static top-level imports of services are fine with the Prisma test context.
- Use `ctx.getDataAccess().client` for direct DB assertions.
- Run mutating integration suites with `--pool=forks` or `--no-file-parallelism` when Prisma singleton state is involved.

## K3s Tests

- Use `createK3sTestContext()` for real Kubernetes integration coverage.
- Mock `@/server/adapter/kubernetes-api.adapter` before any related imports.
- Use `ctx.getClients()` for typed Kubernetes clients.
- Use `ctx.getKubeConfig()` only when raw kubeconfig access is needed.
- Expect slower startup and Docker requirements for these suites.

## Reference

See `REFERENCE.md` for exact naming rules, folder structure, code examples, runtime caveats, and test commands.
