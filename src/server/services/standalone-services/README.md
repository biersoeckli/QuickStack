# What are Standalone Services

Standalone services are service classes wich can be used within a Next.JS request context or in a standalone context (for example at application startup, without any Next.JS specific features).

## Consumers

- `src/server.ts` starts persistent services such as cron jobs and watchers.
- Socket.IO and other custom-server handlers call event-driven services for a request or connection.
- Regular server services may use standalone services when they need the same Node-only behavior.

## Rules

- Keep the module independent of `next/cache`, `next/navigation`, `next/server`, Server Actions, and App Router request state.
- Use adapters for database, Kubernetes, filesystem, and other external access.
- Export one default singleton per file.
- Cron jobs use `scheduleService`, catch errors in their callbacks, and are initialized from `src/server.ts`.
- Event-driven services do not need cron registration or startup initialization.

## Placement

Use this folder when a module must be consumable by a custom Node runtime. Keep Next.js cache-aware or App Router-specific orchestration in `src/server/services/` or `src/app/`.