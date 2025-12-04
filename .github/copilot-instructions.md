# QuickStack AI Coding Instructions

QuickStack is a self-hosted PaaS built with Next.js 14 (App Router) that manages Kubernetes (k3s) deployments. It uses a custom server (`src/server.ts`) that wraps Next.js to handle WebSockets for terminal streaming.

## Architecture Overview

### Three-Layer Structure
- **`src/app/`** - Next.js App Router pages and Server Actions (all pages use `'use server'`)
- **`src/server/`** - Backend services that interact with Kubernetes and database
- **`src/shared/`** - Shared models, utils, and Zod schemas (used by both frontend and server)

### Key Adapters (`src/server/adapter/`)
- `kubernetes-api.adapter.ts` - Wraps `@kubernetes/client-node` APIs (`k3s.core`, `k3s.apps`, etc.)
- `db.client.ts` - Prisma singleton (`dataAccess.client`)
- `longhorn-api.adapter.ts` - Longhorn storage API

### Service Pattern
Services are singleton classes exported as default instances:
```typescript
class AppService { /* methods */ }
const appService = new AppService();
export default appService;
```

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

## Database & Prisma

- SQLite database at `storage/db/data.db`
- Schema: `prisma/schema.prisma`
- Zod schemas auto-generated to `src/shared/model/generated-zod/`
- After schema changes: `yarn prisma-migrate` (runs `prisma migrate dev` + fixes Zod imports)
- Use `dataAccess.client` for queries, supports transactions via `$transaction()`

## Kubernetes Naming Conventions

Use `KubeObjectNameUtils` for consistent k8s object names:
- `toProjectId(name)` → `proj-{name}-{hash}`
- `toAppId(name)` → `app-{name}-{hash}`
- `toPvcName(volumeId)` → `pvc-{volumeId}`
- `toServiceName(appId)` → `svc-{appId}`

## Frontend Patterns

### State Management
Zustand stores in `src/frontend/states/zustand.states.ts`:
- `useConfirmDialog` - Promise-based confirmation dialogs
- `useInputDialog` - Promise-based input dialogs
- `useBreadcrumbs` - Page breadcrumb navigation

### UI Components
- shadcn/ui components in `src/components/ui/`
- Custom components in `src/components/custom/`
- Forms use `react-hook-form` with Zod resolvers

### Real-time Updates
- Socket.IO server at `/pod-terminal` namespace for terminal streaming
- WebSocket server for live pod logs

## Caching

Next.js `unstable_cache` with tag-based invalidation:
```typescript
// Reading with cache
await unstable_cache(
    async () => dataAccess.client.app.findMany({ where: { projectId } }),
    [Tags.apps(projectId)],
    { tags: [Tags.apps(projectId)] }
)(projectId);

// Invalidating after mutations
revalidateTag(Tags.apps(projectId));
```

## Testing

- Jest with jsdom environment
- Tests in `src/__tests__/{frontend,server,shared}/`
- Path alias `@/` maps to `src/`
- Run: `yarn test`

## Development Setup

1. Use provided devcontainer (includes Node, Bun, Prisma extension)
2. Provide k3s credentials in `kube-config.config` at project root
3. `yarn install` → `yarn dev` for Next.js or `yarn dev-live` for custom server

## Commit Convention

Follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
