---
description: "Use when creating, editing, or reviewing QuickStack backend unit tests or integration tests. Covers Jest test patterns, mocking, SQLite-backed Prisma integration tests, and required folder/file naming conventions."
applyTo: "src/server/**/*.spec.ts, src/server/**/*.test.ts, src/shared/**/*.spec.ts, src/shared/**/*.test.ts, src/__tests__/integration/**/*.spec.ts, src/__tests__/integration/**/*.test.ts"
---

# QuickStack Backend Testing Conventions

## File Naming

| Type | Suffix | Example |
|------|--------|---------|
| Unit test | `*.unit.spec.ts` | `build.service.unit.spec.ts` |
| Integration test | `*.integration.spec.ts` | `build.service.integration.spec.ts` |

Never use `.test.ts` for new backend test files. Existing `.test.ts` files are legacy and should be migrated to `*.unit.spec.ts` or `*.integration.spec.ts` when touched.

## Folder Structure

Unit tests live next to the source file:

```text
src/
  server/
    services/
      build.service.ts
      build.service.unit.spec.ts
```

Integration tests live in `src/__tests__/integration/`, mirroring the path under `src/`:

```text
src/
  __tests__/
    integration/
      server/
        services/
          build.service.integration.spec.ts
```

Use this split for backend logic in `src/server/` and for backend-adjacent shared modules in `src/shared/` that need database-backed or cross-layer verification.

## Unit Tests

- Framework: Jest with `describe`, `it`, `expect`, `beforeEach`, and `jest.fn()`.
- Mock all external dependencies: Prisma/data access, Kubernetes adapters, S3/Longhorn adapters, filesystem access, network calls, and other singleton services.
- Use `jest.mock()` plus `jest.mocked()` or `jest.Mocked<T>` for typed mocks.
- Use `jest.requireActual()` for partial mocks when one function must stay real.
- Prefer `@/...` imports for app modules, matching the existing Jest alias configuration.
- Keep unit tests deterministic and isolated. They must not talk to the real SQLite database, Kubernetes, or the filesystem unless the test is explicitly an integration test.
- If a module reads environment variables or initializes singletons at import time, set the environment first and call `jest.resetModules()` before importing the module under test.

```typescript
import { V1JobStatus } from '@kubernetes/client-node';

jest.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
jest.mock('@/server/adapter/db.client', () => ({ default: { client: {} } }));
jest.mock('@/server/services/namespace.service', () => ({ default: {} }));
jest.mock('@/server/services/registry.service', () => ({ default: {}, BUILD_NAMESPACE: 'qs-build' }));
jest.mock('@/server/services/param.service', () => ({ default: {}, ParamService: {} }));

import buildService from './build.service';

describe('build.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns RUNNING when ready is greater than 0', () => {
        const status: V1JobStatus = { ready: 1 };
        expect(buildService.getJobStatusString(status)).toBe('RUNNING');
    });
});
```

## Integration Tests (Prisma + SQLite)

- Use a real temporary SQLite database file, not mocks.
- Place integration suites in `src/__tests__/integration/`, mirroring the source path.
- **Always use `createPrismaTestContext` from `src/__tests__/prisma-test.utils.ts`** to set up and tear down the database. Never copy the lifecycle boilerplate manually.
- Pass a short, descriptive label that identifies the suite (e.g. `'build-service'`).
- Wire the three lifecycle hooks: `beforeAll(ctx.setup)`, `beforeEach(ctx.resetTables)`, `afterAll(ctx.teardown)`.
- `ctx.setup` sets `DATABASE_URL`, clears the Prisma singleton, calls `jest.resetModules()`, and runs `npx prisma db push --skip-generate`.
- `ctx.resetTables` deletes all rows in FK-safe order so each test starts from a clean state.
- `ctx.teardown` disconnects Prisma and removes the temp file.
- Import `dataAccess` dynamically inside each test (or `beforeEach`) so it binds to the temp database after `jest.resetModules()`.

```typescript
import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';

const ctx = createPrismaTestContext('build-service');

describe('build.service integration', () => {
    beforeAll(ctx.setup);
    beforeEach(ctx.resetTables);
    afterAll(ctx.teardown);

    it('persists and reloads data through Prisma', async () => {
        const { default: dataAccess } = await import('@/server/adapter/db.client');

        const created = await dataAccess.client.user.create({
            data: {
                email: 'alice@example.com',
                password: 'secret',
            },
        });

        const fetched = await dataAccess.client.user.findUnique({
            where: { id: created.id },
        });

        expect(fetched?.email).toBe('alice@example.com');
    });
});
```

## Running Tests

```bash
yarn test
yarn test --watch
yarn test --runInBand src/server/services/build.service.unit.spec.ts
yarn test --runInBand src/__tests__/integration/server/services/build.service.integration.spec.ts
```

Use `--runInBand` for integration suites that mutate `process.env.DATABASE_URL` or Prisma singleton state.

## Integration Tests (Kubernetes / K3s)

- Use `createK3sTestContext` from `src/__tests__/k3s-test.utils.ts` to spin up a real k3s cluster in Docker via testcontainers.
- Wire **only two** lifecycle hooks: `beforeAll(ctx.setup)` and `afterAll(ctx.teardown)`. No `beforeEach` reset needed — recreate Kubernetes resources per test using unique names.
- Call `ctx.getClients()` inside tests (or `beforeAll`) to get typed API clients (`core`, `apps`, `batch`, `network`, `customObjects`, `metrics`) wired to the test cluster.
- Use `ctx.getKubeConfig()` when you need the raw `KubeConfig` object (e.g., for custom watchers or log streaming).
- To test a service that depends on `K3sApiAdapter`, mock the adapter module and populate it with clients from the context:

```typescript
jest.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

// in beforeAll, after ctx.setup:
const { default: k3sAdapter } = await import('@/server/adapter/kubernetes-api.adapter');
Object.assign(k3sAdapter, ctx.getClients());
```

- K3s startup takes 20–30 s. Add `jest.setTimeout(120_000)` at the top of every K3s integration suite.
- Run with `--runInBand` to avoid multiple containers competing for Docker resources.
- **Requires Docker with privileged container support.** Will not work in rootless Docker or Docker-in-Docker environments that forbid privileged containers.

```typescript
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';

jest.setTimeout(120_000);

const ctx = createK3sTestContext();

describe('namespace.service integration', () => {
    beforeAll(ctx.setup);
    afterAll(ctx.teardown);

    it('lists the default namespaces', async () => {
        const { core } = ctx.getClients();
        const result = await core.listNamespace();
        const names = result.items.map((ns) => ns.metadata?.name);
        expect(names).toContain('kube-system');
        expect(names).toContain('default');
    });
});
```

## Scope Note

- This file covers backend tests for `src/server/` and backend-oriented `src/shared/` modules.
- Frontend and component tests continue to follow the existing Jest + Testing Library patterns under `src/__tests__/frontend/`.
- This file defines testing structure and test-writing rules only. It does not change backend architecture or authorization patterns.