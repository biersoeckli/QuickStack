# Backend Testing Reference

## File Naming

| Type | Suffix | Example |
|------|--------|---------|
| Unit test | `*.unit.spec.ts` | `build.service.unit.spec.ts` |
| Integration test | `*.integration.spec.ts` | `build.service.integration.spec.ts` |

Never use `.test.ts` for new backend tests. When touching legacy backend `.test.ts` files, migrate them to the appropriate `*.unit.spec.ts` or `*.integration.spec.ts` name.

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

Use the same split for backend logic in `src/server/` and backend-adjacent shared modules in `src/shared/` when they need database-backed or cross-layer verification.

## Unit Test Rules

- Framework: Vitest with `describe`, `it`, `expect`, `beforeEach`, and `vi.fn()`.
- Vitest globals are available without imports.
- Mock all external dependencies, including Prisma/data access, Kubernetes adapters, S3/Longhorn adapters, filesystem access, network calls, and singleton services.
- Use `vi.mock()` plus `vi.mocked()` for typed mocks.
- Use `vi.importActual()` when one function must remain real.
- Prefer `@/...` imports that match the project alias setup.
- Keep unit tests deterministic and isolated.
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

## Prisma + SQLite Integration Tests

- Use a real temporary SQLite database file, not mocks.
- Place suites in `src/__tests__/integration/`, mirroring the source path.
- Always use `createPrismaTestContext` from `src/__tests__/prisma-test.utils.ts`.
- Call `createPrismaTestContext('label')` at the top of the `describe` block.
- The helper automatically registers `beforeAll`, `beforeEach`, and `afterAll`.
- Pass a short descriptive label such as `'build-service'`.
- The context mutates `dataAccess.client` on the shared singleton, so static top-level service imports are fine.
- Use `ctx.getDataAccess().client` for direct DB access in assertions.
- These suites run in the `node` environment via Vitest config.

```typescript
// @vitest-environment node
import mockNextJsCaching from '@/__tests__/nextjs-cache.utils';
mockNextJsCaching();
vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import { createPrismaTestContext } from '@/__tests__/prisma-test.utils';
import appService from '@/server/services/app.service';

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

## Kubernetes / K3s Integration Tests

- Use `createK3sTestContext` from `src/__tests__/k3s-test.utils.ts`.
- Call `createK3sTestContext()` at the top of the `describe` block.
- The helper automatically registers cluster startup and teardown hooks.
- Use `ctx.getClients()` for typed clients: `core`, `apps`, `batch`, `log`, `network`, `customObjects`, and `metrics`.
- Use `ctx.getKubeConfig()` only when the raw `KubeConfig` object is required.
- Mock `@/server/adapter/kubernetes-api.adapter` at the top of the test file before any import that may load services using it.
- If mock order is wrong, the real singleton may initialize and try to read `/workspace/kube-config.config`.
- K3s startup usually takes 20–30 seconds.
- Use `{ timeout: 120_000 }` in setup or configure Vitest `testTimeout`.
- Run with `--no-file-parallelism` to avoid Docker resource conflicts.
- Docker with privileged container support is required.

```typescript
import { createK3sTestContext } from '@/__tests__/k3s-test.utils';

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('namespace.service integration', () => {
    const { getClients, getKubeConfig } = createK3sTestContext();

    it('lists the default namespaces', async () => {
        const { core } = getClients();
        const result = await core.listNamespace();
        const names = result.items.map((ns) => ns.metadata?.name);
        expect(names).toContain('kube-system');
        expect(names).toContain('default');
    });
});
```

## Scope

- This skill covers backend tests for `src/server/` and backend-oriented `src/shared/` modules.
- Frontend and component tests follow separate frontend testing conventions.
- This skill defines test structure and test-writing rules only; it does not change backend architecture or authorization patterns.
