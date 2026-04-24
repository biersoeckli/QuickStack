---
description: "Use when creating, editing, or reviewing QuickStack backend unit tests or integration tests. Covers Vitest test patterns, mocking, SQLite-backed Prisma integration tests, k3s integration tests and required folder/file naming conventions."
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

- Framework: Vitest with `describe`, `it`, `expect`, `beforeEach`, and `vi.fn()`.
- All Vitest globals (`vi`, `describe`, `it`, `expect`, `beforeEach`, etc.) are available without imports (`globals: true` in vitest.config.ts).
- Mock all external dependencies: Prisma/data access, Kubernetes adapters, S3/Longhorn adapters, filesystem access, network calls, and other singleton services.
- Use `vi.mock()` plus `vi.mocked()` for typed mocks.
- Use `vi.importActual()` for partial mocks when one function must stay real.
- Prefer `@/...` imports for app modules, matching the alias configuration in vitest.config.ts.
- Keep unit tests deterministic and isolated. They must not talk to the real SQLite database, Kubernetes, or the filesystem unless the test is explicitly an integration test.
- If a module reads environment variables or initializes singletons at import time, set the environment first and call `vi.resetModules()` before importing the module under test.

```typescript
import { V1JobStatus } from '@kubernetes/client-node';

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/adapter/db.client', () => ({ default: { client: {} } }));
vi.mock('@/server/services/namespace.service', () => ({ default: {} }));
vi.mock('@/server/services/registry.service', () => ({ default: {}, BUILD_NAMESPACE: 'qs-build' }));
vi.mock('@/server/services/param.service', () => ({ default: {}, ParamService: {} }));

import buildService from './build.service';

describe('build.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
- Call `createPrismaTestContext('label')` at the top of the `describe` block. It **automatically registers** `beforeAll` (DB setup + client swap), `beforeEach` (table reset), and `afterAll` (teardown) — no manual hook wiring needed.
- Pass a short, descriptive label that identifies the suite (e.g. `'build-service'`).
- The context works by **mutating `dataAccess.client`** on the shared singleton. Services that call `dataAccess.client` internally automatically use the test DB — no `vi.resetModules()` or dynamic imports needed. **Static top-level imports of services are fine.**
- Use `ctx.getDataAccess().client` for direct DB access in tests.
- Integration tests run in the `node` environment (configured via `environmentMatchGlobs` in vitest.config.ts).

```typescript
// @vitest-environment node
import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching(); // Mocks Next.js caching functions to prevent errors when services call revalidateTag or unstable_cache during tests.
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import appService from '@/server/services/app.service'; // static import is fine

describe('app.service integration', () => {
    const dbCtx = createPrismaTestContext('app-service');

    it('service writes to test DB', async () => {
        await appService.create({ name: 'my-app', projectId: '...' });

        const apps = await dbCtx.getDataAccess().client.app.findMany();
        expect(apps).toHaveLength(1);
    });

    it('direct DB access', async () => {
        const created = await dbCtx.getDataAccess().client.user.create({
            data: { email: 'alice@example.com', password: 'secret' },
        });
        const fetched = await dbCtx.getDataAccess().client.user.findUnique({ where: { id: created.id } });
        expect(fetched?.email).toBe('alice@example.com');
    });
});
```

## Running Tests

```bash
yarn test
yarn test:watch
yarn test src/server/services/build.service.unit.spec.ts
yarn test src/__tests__/integration/server/services/build.service.integration.spec.ts
```

Use `--pool=forks` or `--no-file-parallelism` for integration suites that mutate `process.env.DATABASE_URL` or Prisma singleton state.

## Integration Tests (Kubernetes / K3s)

- Use `createK3sTestContext` from `src/__tests__/k3s-test.utils.ts` to spin up a real k3s cluster in Docker via testcontainers.
- Call `createK3sTestContext()` at the top of the `describe` block. It **automatically registers** `beforeAll` (cluster start + adapter wiring) and `afterAll` (teardown) — no manual hook wiring needed.
- Call `ctx.getClients()` inside tests to get typed API clients (`core`, `apps`, `batch`, `log`, `network`, `customObjects`, `metrics`) wired to the test cluster.
- Use `ctx.getKubeConfig()` when you need the raw `KubeConfig` object (e.g., for custom watchers).
- `K3sApiAdapter` is **automatically wired** with test cluster clients in the registered `beforeAll`. To use this, mock the adapter module at the top of the test file (before any imports):

```typescript
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
```

- **Import order is strict**: keep the adapter mock above any import that may transitively load services using `@/server/adapter/kubernetes-api.adapter`.
- If mock order is wrong, the real singleton may initialize during module import and try to read `/workspace/kube-config.config`

- K3s startup takes 20–30 s. Use `{ timeout: 120_000 }` in the `beforeAll` or configure via vitest's `testTimeout`.
- Run with `--no-file-parallelism` to avoid multiple containers competing for Docker resources.
- **Requires Docker with privileged container support.** Will not work in rootless Docker or Docker-in-Docker environments that forbid privileged containers.

```typescript
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('namespace.service integration', () => {
    const { getClients, getKubeConfig } = createK3sTestContext();
    // K3sApiAdapter is automatically wired — no extra beforeAll needed

    it('lists the default namespaces', async () => {
        const { core } = getClients();
        const result = await core.listNamespace();
        const names = result.items.map((ns) => ns.metadata?.name);
        expect(names).toContain('kube-system');
        expect(names).toContain('default');
    });
});
```

## Scope Note

- This file covers backend tests for `src/server/` and backend-oriented `src/shared/` modules.
- Frontend and component tests follow the same Vitest patterns under `src/frontend/` and `src/__tests__/frontend/`.
- This file defines testing structure and test-writing rules only. It does not change backend architecture or authorization patterns.