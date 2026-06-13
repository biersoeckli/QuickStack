# Backend Services Reference

## Service singleton pattern

Use one class per file with a default-exported singleton instance:

```ts
import deploymentService from "./deployment.service";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { revalidateTag } from "next/cache";

class ThingService {

    async getAll() {
        return await unstable_cache(
        async () => db.client.thing.findMany({ orderBy: { createdAt: 'desc' } }),
        [Tags.thing()], // Cache key
        { tags: [Tags.thing()] } // Cache tags for revalidation
        )();
    }

    async getByIdOrDefault(id: string) {
        return unstable_cache(async (innerId) =>  // never pass raw params directly to cache callback, always through wrapper function parameters for consistent cache key generation
                db.client.thing.findFirst({ where: { id: innerId } }),
            [Tags.thing()], // Cache key
            { tags: [Tags.thing()] } // Cache tags for revalidation
        )(id);
    }

    async getById(id: string) {
        return unstable_cache(async (innerId) => // never pass raw params directly to cache callback, always through wrapper function parameters for consistent cache key generation
                db.client.thing.findFirstOrThrow({ where: { id: innerId } }),
            [Tags.thing()], // Cache key
            { tags: [Tags.thing()] } // Cache tags for revalidation
        )(id);
    }

    async save(data: ThingInput) {
        let createdtem: Thing;
        try {
            if (data.id) {
                createdtem = await db.client.thing.update({ where: { id: data.id }, data });
            }
            createdtem = await db.client.thing.create({ data });
            return createdtem;
        } finally {
            revalidateTag(Tags.thing()); // Invalidate cache after mutation
            revalidateTag(Tags.thing(createdtem.ownerId)); // Invalidate cache after mutation --> Variant if for example owner-specific
        }
    }

    async deleteById(id: string) {
        try {
            await dataAccess.client.thing.delete({ where: { id } });
        } finally {
            revalidateTag(Tags.thing(id));
        }
    }
}

const thingService = new ThingService();
export default thingService;
```

Rules:

- One class per file, one singleton instance, default export.
- All public methods are `async`.
- Accept primitives or shared model types as parameters.
- Import singleton dependencies; do not instantiate services inside services.
- For each database mutation, invalidate with `revalidateTag()` in `finally`.

## Adapter pattern

Adapters in `src/server/adapter/` wrap external APIs and follow the same singleton export style.

- `kubernetes-api.adapter.ts` exposes the Kubernetes clients through `k3s`.
- `db.client.ts` exposes Prisma via `dataAccess.client`.
- `aws-s3.adapter.ts` and `longhorn-api.adapter.ts` wrap storage integrations.

Never call Prisma or `@kubernetes/client-node` directly from services.

## Standalone services

Standalone services live in `src/server/services/standalone-services/` for startup tasks, cron jobs, and background work.

```ts
class AppLogsService {
    configureCronJobs() {
        scheduleService.scheduleJob('daily-logs-to-file', '10 0 * * *', async () => {
            try {
                await this.backupLogsForAllRunningAppsForYesterday();
                await this.deleteOldAppLogs();
            } catch (error) {
                logger.error(error);
            }
        });
    }
}
```

Rules:

- Register cron jobs through `scheduleService`.
- Wrap cron callback bodies in `try/catch`.
- Log errors and do not rethrow from cron callbacks.
- Initialize these services from `src/server.ts`.

## Server action wrappers

Use wrappers from `src/server/utils/action-wrapper.utils.ts`:

```ts
export const saveApp = async (data: AppModel) =>
    saveFormAction(data, AppModelSchema, async (validated) => {
        await getAuthUserSession(); // auth check in action boundary, not service
        await appService.save(validated);
    });

export const deleteApp = async (id: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(id); // auth check in action boundary, not service
        await appService.deleteById(id);
    });
```

Rules:

- Use `saveFormAction` for validated form submissions.
- Use `simpleAction` for non-form actions.
- Put authorization checks inside the callback before service calls.
- Let the wrappers produce success payloads; do not manually construct them unless returning data.

## Authorization helpers

Common helpers from `action-wrapper.utils.ts` include:

- `getAuthUserSession()`
- `getAdminUserSession()`
- `isAuthorizedReadForApp(appId)`
- `isAuthorizedWriteForApp(appId)`
- `isAuthorizedForBackups()`

Use the shared helper that matches the resource and access level you need.

## Error handling

Throw shared domain exceptions for expected failures:

```ts
import { ServiceException } from "@/shared/model/service.exception.model";

if (hostnameInUse) {
    throw new ServiceException("Hostname is already in use by this or another app.");
}
```

- Use `ServiceException` for domain errors.
- Use `FormValidationException` for field-level validation errors.
- Do not throw raw `Error` for expected service-level failures.

## Prisma and transactions

- Database access goes through `dataAccess.client`.
- Use `dataAccess.client.$transaction(...)` when multiple writes must succeed or fail together.
- Use `dataAccess.updateManyItems()` helpers for batch updates.
- After Prisma schema changes, run `yarn prisma-migrate`.

Relevant paths:

- `prisma/schema.prisma`
- `src/shared/model/generated-zod/`
- `storage/db/data.db`

## Kubernetes naming

Use `src/server/utils/kube-object-name.utils.ts` for all Kubernetes resource names.

- `toProjectId(name)` → `proj-{name}-{hash}`
- `toAppId(name)` → `app-{name}-{hash}`
- `toJobName(appId)` → `build-{appId}`
- `toServiceName(appId)` → `svc-{appId}`
- `toPvcName(volumeId)` → `pvc-{volumeId}`
- `addRandomSuffix(str)` → `{str}-{8-char-hex}`

Do not hardcode Kubernetes object names.

## Caching

Read with `unstable_cache` and invalidate with `revalidateTag`:

```ts
const apps = await unstable_cache(
    async () => dataAccess.client.app.findMany({ where: { projectId } }),
    [Tags.apps(projectId)],
    { tags: [Tags.apps(projectId)] }
)();
```

Available helpers include:

- `Tags.users()`
- `Tags.userGroups()`
- `Tags.projects()`
- `Tags.apps(projectId)`
- `Tags.app(appId)`
- `Tags.appBuilds(appId)`
- `Tags.s3Targets()`
- `Tags.volumeBackups()`
- `Tags.parameter()`
- `Tags.nodeInfos()`

Always use `Tags.*` helpers instead of string literals.

## Layer summary

- `src/server/services/` → business logic singletons.
- `src/server/services/standalone-services/` → background and cron singletons.
- `src/server/adapter/` → external API wrappers.
- `src/server/utils/` → static helper classes.
- `src/shared/model/` → shared contracts and schemas.

## Custom server startup

`src/server.ts` is responsible for:

1. Initializing WebSocket and Socket.IO support.
2. Running production migrations with `npx prisma migrate deploy`.
3. Calling `quickStackService.initializeQuickStack()`.
4. Starting standalone services.

For local development, use `yarn dev-live`.
