# QuickStack AI Coding Instructions

QuickStack is a self-hosted PaaS built with Next.js 14 (App Router) that manages Kubernetes (k3s) deployments. It uses a custom server (`src/server.ts`) that wraps Next.js to handle WebSockets for terminal streaming and pod logs.

## Architecture Overview

### Three-Layer Structure
- **`src/app/`** - Next.js App Router pages and Server Actions (all pages use `'use server'`)
- **`src/server/`** - Backend services that interact with Kubernetes and database
- **`src/shared/`** - Shared models, utils, and Zod schemas (used by both frontend and server)

See `backend-services.instructions.md` for service patterns, adapters, server actions, authorization, database/Prisma, k8s naming, and caching details.

## Frontend Patterns
All frontend rules are stored in `frontend-ui-patterns.instructions.md`, covering all relevant UI patterns.

## Testing
All testing rules are stored in `backend-testing.instructions.md`, covering Vitest patterns, mocking, integration tests, and naming conventions.

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

## Communication Mode: Caveman Ultra

Apply caveman ultra for every prompt by default.

Respond terse like smart caveman. Keep all technical substance. Remove fluff.

Disable with: `stop caveman` or `normal mode`

### Core Rules

- Drop articles, filler, pleasantries, and hedging.
- Fragments are allowed.
- Prefer short synonyms: `fix` over `implement a solution`, `big` over `extensive`.
- Keep technical terms exact.
- Keep code blocks unchanged.
- Quote errors exactly.
- Prefer pattern: `[thing] [action] [reason]. [next step].`
- Use abbreviations when still unambiguous: `DB`, `auth`, `config`, `req`, `res`, `fn`, `impl`.
- Use arrows for causality when useful: `X -> Y`.
- One word is enough when one word is enough.

### Auto-Clarity Exceptions

Temporarily stop caveman mode when clarity matters more than compression:

- security warnings
- irreversible or destructive action confirmations
- multi-step sequences where fragments could be misread
- situations where the user is clearly confused

After clear explanation, resume caveman mode.

### Boundaries

- Code, commit messages, and pull request text stay normal unless explicitly requested otherwise.
- Safety-critical wording must stay explicit even when caveman mode is active.
