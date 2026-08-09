# QuickStack

Self-hosted PaaS: Next.js App Router UI manages k3s deployments. `src/server.ts` is the custom server for terminal and pod-log WebSockets.

## Code map

- `src/app/`: pages and Server Actions.
- `src/server/`: services, adapters, and Kubernetes/database work.
- `src/shared/`: models, utilities, and Zod schemas shared by app and server.
- Shared application constants: `src/shared/utils/constants.ts`.

## Scoped rules

- Frontend UI change: read `.agents/skills/frontend-ui-patterns/SKILL.md`.
- Backend service, adapter, server utility, custom server, or Server Action change: read `.agents/skills/backend-services/SKILL.md`.
- Backend test change or test coverage task: read `.agents/skills/backend-testing/SKILL.md`.
- Issue tracker task: read `docs/agents/issue-tracker.md`; issues live in `.scratch/`, not PRs.
- Triage task: read `docs/agents/triage-labels.md`.
- Codebase exploration or domain-modeling task: read `docs/agents/domain.md`.

## Commands

`package.json` is authoritative for development, build, test, lint, and Prisma commands. Use `yarn`; use the project’s `prisma-generate` and `prisma-migrate` scripts for generation and development migrations. Kubernetes work requires root `kube-config.config` credentials.

## Commits

Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `style:`).

## Communication: Caveman Ultra

Default: terse, direct, technically exact. Use fragments, short words, unambiguous abbreviations, and `->` for causality. Quote errors exactly. Keep code, commit messages, and PR text normal.

Use full prose for security or destructive-action warnings, ambiguous multi-step instructions, or user confusion. Return to terse mode after.
