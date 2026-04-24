---
description: "Use when creating, editing, or reviewing QuickStack backend services, adapters, standalone services, or server-side utilities. Covers singleton patterns, adapter abstraction, error handling, caching, and dependency wiring."
---

# QuickStack Backend Services & Architecture

## Service Pattern

Services are class-based singletons with a default export. No constructor injection — dependencies are module-level imports of other singletons.

```typescript
import deploymentService from "./deployment.service";
import k3s from "../adapter/kubernetes-api.adapter";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { revalidateTag } from "next/cache";

class AppService {
    async deleteById(id: string) {
        try {
            await deploymentService.deleteDeployment(id);
            await dataAccess.client.app.delete({ where: { id } });
        } finally {
            revalidateTag(Tags.app(id));
        }
    }
}

const appService = new AppService();
export default appService;
```

Rules:
- One class per file, one singleton instance, default export
- All public methods `async`
- Accept primitives or model types as parameters
- Never instantiate services inside other services — import the singleton
- Call `revalidateTag()` after mutations that affect cached data

## Adapter Pattern

Adapters in `src/server/adapter/` wrap external APIs (k8s, Prisma, S3, Longhorn). Same singleton export pattern.

| Adapter | Singleton | Wraps |
|---------|-----------|-------|
| `kubernetes-api.adapter.ts` | `k3s` | `@kubernetes/client-node` — exposes `core`, `apps`, `batch`, `log`, `network`, `customObjects`, `metrics` |
| `db.client.ts` | `dataAccess` | Prisma client — `dataAccess.client` for queries, `.updateManyItems()` for batch ops |
| `aws-s3.adapter.ts` | default | S3-compatible storage operations |
| `longhorn-api.adapter.ts` | default | Longhorn storage HTTP API |

Access adapters by importing their default export:

```typescript
import k3s from "@/server/adapter/kubernetes-api.adapter";
import dataAccess from "@/server/adapter/db.client";

const pods = await k3s.core.listNamespacedPod(namespace);
const app = await dataAccess.client.app.findUnique({ where: { id } });
```

Never call `@kubernetes/client-node` or Prisma directly in services — always go through the adapter.

## Standalone Services

`src/server/services/standalone-services/` — services that run outside Next.js request context (startup, cron, background jobs).

Same singleton pattern, but integrate with `scheduleService` for cron:

```typescript
class AppLogsService {
    configureCronJobs() {
        scheduleService.scheduleJob('daily-logs-to-file', '10 0 * * *', async () => {
            await this.backupLogsForAllRunningAppsForYesterday();
            await this.deleteOldAppLogs();
        });
    }
}
```

Standalone services are initialized in `src/server.ts` at application startup.

## Server Actions

All server actions use wrappers from `src/server/utils/action-wrapper.utils.ts`:

```typescript
// Form submission with Zod validation
export const saveApp = async (data: AppModel) =>
    saveFormAction(data, AppModelSchema, async (validated) => {
        await appService.save(validated);
    });

// Simple action without form validation
export const deleteApp = async (id: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(id);
        await appService.deleteById(id);
    });

// Simple action with callback result (callback can also be applied to form actions if needed)
export const restartApp = async (id: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(id);
        const result = await appService.restart(id);
        return result;
    });
```

Rules:
- Always wrap in `saveFormAction` (forms) or `simpleAction` (non-form) — never call services directly from actions
- Auth checks go inside the action callback, before the service call.
- Return `SuccessActionResult` on success

## Authorization

Helpers from `action-wrapper.utils.ts`:

| Helper | Purpose |
|--------|---------|
| `getAuthUserSession()` | Requires authenticated user, redirects to `/auth` if not |
| `getAdminUserSession()` | Requires admin role |
| `isAuthorizedReadForApp(appId)` | Checks read permissions for specific app |
| `isAuthorizedWriteForApp(appId)` | Checks write permissions for specific app |
| `isAuthorizedForBackups()` | Checks backup permissions |

## Error Handling

Throw `ServiceException` for domain errors. Never throw raw `Error` from service logic.

```typescript
import { ServiceException } from "@/shared/model/service.exception.model";

if (hostnameInUse) {
    throw new ServiceException("Hostname is already in use by this or another app.");
}
```

Flow: service throws `ServiceException` → `simpleAction`/`saveFormAction` catches → returns `{ status: 'error', message }` to client.

For form validation errors, throw `FormValidationException` with field-level errors.

## Database & Prisma

- **SQLite** database at `storage/db/data.db` (using `@prisma/adapter-better-sqlite3`)
- Schema: `prisma/schema.prisma`
- Zod schemas auto-generated to `src/shared/model/generated-zod/`
- After schema changes: **`yarn prisma-migrate`** (runs `prisma migrate dev` + fixes Zod imports via `fix-wrong-zod-imports.js`)
- Access via `dataAccess.client` for queries
- Transactions: `dataAccess.client.$transaction(async (tx) => { ... })`
- Batch updates: `dataAccess.updateManyItems()` and `dataAccess.updateManyItemsWithExistingTransaction()`

**Critical**: After Prisma schema changes, `yarn prisma-migrate` automatically fixes incorrect Zod imports that `zod-prisma` generator produces.

## Kubernetes Naming Conventions

Use `KubeObjectNameUtils` (`src/server/utils/kube-object-name.utils.ts`) for all k8s object names:

| Method | Output format |
|--------|---------------|
| `toProjectId(name)` | `proj-{name}-{hash}` (max 30 chars + prefix) |
| `toAppId(name)` | `app-{name}-{hash}` |
| `toJobName(appId)` | `build-{appId}` |
| `toServiceName(appId)` | `svc-{appId}` |
| `toPvcName(volumeId)` | `pvc-{volumeId}` |
| `addRandomSuffix(str)` | `{str}-{8-char-hex}` |

All names: snake_case → kebab-case, lowercased, non-alphanumeric chars removed. Never hardcode k8s resource names.

## Utility Classes

Utils use static methods — no instances:

| Utility | Purpose |
|---------|---------|
| `KubeObjectNameUtils` | K8s resource naming (see above) |
| `Tags` | Cache tag generation (see below) |
| `EnvVarUtils` | Parse environment variable strings |
| `CommandExecutorUtils` | Shell command execution |

## Caching

Read with `unstable_cache`, invalidate with `revalidateTag` after mutations:

```typescript
import { unstable_cache, revalidateTag } from "next/cache";

// Read
const apps = await unstable_cache(
    async () => dataAccess.client.app.findMany({ where: { projectId } }),
    [Tags.apps(projectId)],
    { tags: [Tags.apps(projectId)] }
)();

// Invalidate after write with an try/finally to ensure it always happens:
try {
    // some mutation that changes apps in the entity
} finally {
    revalidateTag(Tags.apps(projectId));
}
```

Always use `Tags.*` helpers — never hardcode tag values.

**Available tags**: `users()`, `userGroups()`, `projects()`, `apps(projectId)`, `app(appId)`, `appBuilds(appId)`, `s3Targets()`, `volumeBackups()`, `parameter()`, `nodeInfos()`

## Layer Summary

| Layer | Location | Export | Role |
|-------|----------|--------|------|
| Services | `src/server/services/` | `default` singleton | Business logic |
| Standalone | `src/server/services/standalone-services/` | `default` singleton | Background / cron tasks, these services have explicit no nextjs caching |
| Adapters | `src/server/adapter/` | `default` singleton | External API wrappers |
| Utils | `src/server/utils/` | Static class methods | Helpers |
| Models | `src/shared/model/` | Named exports | Data contracts & Zod schemas |

## Custom Server

`src/server.ts` wraps Next.js to handle:
1. WebSocket/Socket.IO initialization
2. Database migration on production startup (`npx prisma migrate deploy`)
3. QuickStack initialization (`quickStackService.initializeQuickStack()`)
4. Standalone service startup (backups, maintenance, password changes, app logs)

Run with `yarn dev-live` (builds TypeScript from `tsconfig.server.json` → `dist/server.js`).
