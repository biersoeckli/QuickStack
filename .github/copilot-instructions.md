# QuickStack AI Coding Instructions

QuickStack is a self-hosted PaaS built with Next.js 14 (App Router) that manages Kubernetes (k3s) deployments. It uses a custom server (`src/server.ts`) that wraps Next.js to handle WebSockets for terminal streaming and pod logs.

## Architecture Overview

### Three-Layer Structure
- **`src/app/`** - Next.js App Router pages and Server Actions (all pages use `'use server'`)
- **`src/server/`** - Backend services that interact with Kubernetes and database
- **`src/shared/`** - Shared models, utils, and Zod schemas (used by both frontend and server)

### Key Adapters (`src/server/adapter/`)
Adapters provide abstraction over external APIs:
- `kubernetes-api.adapter.ts` - Wraps `@kubernetes/client-node` APIs (`k3s.core`, `k3s.apps`, etc.)
- `db.client.ts` - Prisma singleton (`dataAccess.client`) with custom transaction helpers
- `longhorn-api.adapter.ts` - Longhorn storage API
- `aws-s3.adapter.ts` - S3-compatible storage operations

### Service Pattern
Services are singleton classes exported as default instances:
```typescript
class AppService {
    async buildAndDeploy(appId: string) { /* ... */ }
}
const appService = new AppService();
export default appService;
```

**Standalone Services** (`src/server/services/standalone-services/`): Can run outside Next.js request context (e.g., at app startup, scheduled tasks). See `00_info.md` for details.

## Server Actions Pattern

All server actions use wrappers from `src/server/utils/action-wrapper.utils.ts`:

```typescript
// For form submissions with Zod validation
export const saveApp = async (data: AppModel) =>
    saveFormAction(data, AppModelSchema, async (validated) => {
        await appService.save(validated);
        return new SuccessActionResult(undefined, 'App saved');
    }) as Promise<ServerActionResult<any, void>>;

// For simple actions without form validation
export const deleteApp = async (id: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(id);  // Auth check
        await appService.deleteById(id);
        return new SuccessActionResult(undefined, 'App deleted');
    });
```

### Authorization Helpers
- `getAuthUserSession()` - Requires authenticated user, redirects to `/auth` if not
- `getAdminUserSession()` - Requires admin role
- `isAuthorizedReadForApp(appId)` - Checks read permissions for specific app
- `isAuthorizedWriteForApp(appId)` - Checks write permissions for specific app
- `isAuthorizedForBackups()` - Checks backup permissions

## Database & Prisma

- **SQLite** database at `storage/db/data.db` (using `@prisma/adapter-better-sqlite3`)
- Schema: `prisma/schema.prisma`
- Zod schemas auto-generated to `src/shared/model/generated-zod/`
- After schema changes: **`yarn prisma-migrate`** (runs `prisma migrate dev` + fixes Zod imports via `fix-wrong-zod-imports.js`)
- Access via `dataAccess.client` for queries
- Supports transactions: `dataAccess.client.$transaction(async (tx) => { ... })`
- Custom batch update helpers: `dataAccess.updateManyItems()` and `dataAccess.updateManyItemsWithExistingTransaction()`

**Critical**: After Prisma schema changes, `yarn prisma-migrate` automatically fixes incorrect Zod imports that `zod-prisma` generator produces.

## Kubernetes Naming Conventions

Use `KubeObjectNameUtils` (`src/server/utils/kube-object-name.utils.ts`) for consistent k8s object names:
- `toProjectId(name)` → `proj-{name}-{hash}` (max 30 chars + prefix)
- `toAppId(name)` → `app-{name}-{hash}`
- `toJobName(appId)` → `build-{appId}`
- `toServiceName(appId)` → `svc-{appId}`
- `toPvcName(volumeId)` → `pvc-{volumeId}`
- `addRandomSuffix(str)` → `{str}-{8-char-hex}`

All names are snake_case → kebab-case, lowercased, with non-alphanumeric chars removed.

## Caching & Revalidation

Next.js `unstable_cache` with tag-based invalidation using `Tags` utility (`src/server/utils/cache-tag-generator.utils.ts`):

```typescript
// Reading with cache
await unstable_cache(
    async () => dataAccess.client.app.findMany({ where: { projectId } }),
    [Tags.apps(projectId)],
    { tags: [Tags.apps(projectId)] }
)();

// Invalidating after mutations
revalidateTag(Tags.apps(projectId));
revalidateTag(Tags.app(appId));
```

**Available Tags**: `users()`, `userGroups()`, `projects()`, `apps(projectId)`, `app(appId)`, `appBuilds(appId)`, `s3Targets()`, `volumeBackups()`, `parameter()`, `nodeInfos()`

## Frontend Patterns

### State Management
Zustand stores in `src/frontend/states/zustand.states.ts`:
- `useConfirmDialog()` - Promise-based confirmation dialogs
- `useInputDialog()` - Promise-based input dialogs
- `useBreadcrumbs()` - Page breadcrumb navigation

### UI Components
- **shadcn/ui** components in `src/components/ui/`
- Custom components in `src/components/custom/`
- Forms use `react-hook-form` with `@hookform/resolvers` and Zod schemas

### Real-time Communication
- **Socket.IO** (`src/socket-io.server.ts`): `/pod-terminal` namespace for terminal streaming
- **WebSocket** (`src/websocket.server.ts`): Generic WebSocket server for live pod logs

## Custom Server Entry Point

`src/server.ts` wraps Next.js to handle:
1. WebSocket/Socket.IO initialization
2. Database migration on production startup (`npx prisma migrate deploy`)
3. QuickStack initialization (`quickStackService.initializeQuickStack()`)
4. Standalone services (backups, maintenance, password changes, app logs)

Run with `yarn dev-live` (builds TypeScript from `tsconfig.server.json` → `dist/server.js`)

## Testing

- Jest with jsdom environment (`jest.config.ts`)
- Tests in `src/__tests__/{frontend,server,shared}/`
- Path alias `@/` maps to `src/`
- Run: `yarn test`
- Coverage: Collected automatically, output to `coverage/`

## Development Setup

1. Use provided devcontainer (includes Node, Bun, Prisma extension)
2. Provide k3s credentials in `kube-config.config` at project root
3. `yarn install`
4. Development modes:
   - `yarn dev` - Standard Next.js dev server
   - `yarn dev-live` - Custom server with WebSocket support (rebuilds TypeScript)
   - `yarn build` - Production build (Next.js + custom server compilation)
   - `yarn start-prod` - Run production build with custom server

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `style:`

Example: `feat: add database backup scheduling`
