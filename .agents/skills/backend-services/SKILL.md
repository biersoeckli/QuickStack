---
name: backend-services
description: Create and update QuickStack backend services, adapters, standalone services, and server actions using the project's established singleton, adapter, caching, and error-handling patterns. Use when editing files under src/server/services, src/server/adapter, src/server/utils, src/server.ts, or related server-side actions and backend utilities.
---

# Backend Services

## Quick Start

For QuickStack backend work, follow the existing service architecture:

- Use one class per file with a default-exported singleton instance.
- Keep service dependencies as module imports of other singleton services or adapters.
- Route Prisma and external API access through adapters, not directly from services.
- Throw `ServiceException` or `FormValidationException` for expected domain failures.
- Invalidate cache tags in a `finally` block after every database mutation.

## Service Pattern

When creating or editing a service:

- Put business logic in `src/server/services/`.
- Export a singleton instance as the file default export.
- Make all public methods `async`.
- Accept primitives or shared model types as inputs.
- Import dependencies at module scope; do not instantiate sibling services.

## Adapters And Actions

- Put external integrations in `src/server/adapter/` using the same singleton export pattern.
- Use adapters for Prisma, Kubernetes, S3, and Longhorn access.
- Wrap server actions with `simpleAction` or `saveFormAction`.
- Perform authorization checks inside the action callback before calling the service.

## Mutation Rules

- After create, update, or delete operations, call `revalidateTag()` in `finally`.
- Use the matching `Tags.*` helper; never hardcode cache tag strings.
- Use transactions when multiple writes must succeed or fail together.

## Standalone Services

- Place cron and background jobs in `src/server/services/standalone-services/`.
- Register cron jobs with `scheduleService`.
- Wrap cron callback bodies in `try/catch` and log errors instead of rethrowing.
- Initialize standalone services from `src/server.ts`.

## Reference

See `REFERENCE.md` for concrete patterns covering adapters, actions, authorization, Prisma, caching, naming, and startup wiring.
