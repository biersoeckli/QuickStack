# Verification — shadcn/ui Tailwind v4 upgrade (Ticket 09)

- **Date:** 2026-09-15
- **Branch:** `chore/shadcn-tailwind-v4-upgrade`
- **Commit tested:** `e2eb1e566b2bd7b80451681ce7851a610ff27024` (`e2eb1e5 refactor: migrate cn utility to the cn package`)
- **Local runtime:** Node v24.20.0, yarn 1.22.22
- **Working tree:** clean before and after; no commits made.

## 1. Old-pattern sweep

Commands run over `src/`, `package.json`, `components.json`, `postcss.config.mjs`,
`next.config.mjs`, `tsconfig.json`:

```sh
grep -rnE '@radix-ui/react-' src/ package.json components.json postcss.config.mjs next.config.mjs tsconfig.json
grep -rnE 'clsx|tailwind-merge' src/ package.json components.json postcss.config.mjs next.config.mjs tsconfig.json
grep -rn 'tailwindcss-animate' . --exclude-dir=node_modules --exclude-dir=.git --exclude=yarn.lock
grep -nE '"style"[[:space:]]*:[[:space:]]*"default"' components.json
grep -rnE '@tailwind[[:space:]]+(base|components|utilities);' . --exclude-dir=node_modules --exclude-dir=.git
grep -rn 'hsl(var(--' src/
grep -rn 'sidebar-background' src/
```

| Pattern | Result |
| --- | --- |
| `@radix-ui/react-` (non-icons) | **clean** — only `@radix-ui/react-icons` + `"@radix-ui/react-icons": "^1.3.2"` remain (justified exception; unified `radix-ui` used for primitives) |
| `clsx` / `tailwind-merge` | **empty** in `src/` and root configs |
| `tailwindcss-animate` | **empty** in source/configs. Only matches: `.scratch/` ticket/PRD prose and binary hits in the stale pre-existing `.next/cache/webpack/*` (build artifact, not source). Replaced by `tw-animate-css` |
| `style: "default"` in `components.json` | **empty** — now `"style": "new-york"` |
| `@tailwind base\|components\|utilities;` | **empty** |
| `hsl(var(--` in `src/` | **empty** |
| `sidebar-background` in `src/` | **empty** |
| `tailwind.config.*` | absent (removed) |

## 2. Feedback loops

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Lint | `yarn lint` | 0 | **PASS** — 0 errors, 2 pre-existing warnings (`react-hooks/exhaustive-deps` in `project-overview.tsx`; unused `name` in `template-icons.unit.spec.ts`). Non-blocking. |
| Build | `DATABASE_URL="file:./build-check.db" yarn build` | 0 | **PASS** — compiled in 22.7s, 15/15 static pages, `tsc --project tsconfig.server.json` + `tsc-alias` succeeded, `dist/server.js` present. `build-check.db` deleted afterwards. |
| Test | `DATABASE_URL="file:./test-run.db" yarn test` | 1 | **781 passed / 43 skipped / 106 files (101 passed)**, 5 suites failed — all environment-only (no container runtime). No assertion/module/Prisma failures. `test-run.db` not left behind. |

The 5 failed suites all abort in `beforeAll` at `K3sContainer.start()` with:

```
Error: Could not find a working container runtime strategy
    at getContainerRuntimeClient (node_modules/testcontainers/.../client.js:67:11)
    at K3sContainer.start (node_modules/@testcontainers/k3s/.../k3s-container.js:27:27)
    at src/__tests__/k3s-test.utils.ts:109:21
```

Failing suites (all k3s/testcontainers-gated):
`build.service.integration.spec.ts`, `network-policy.service.integration.spec.ts`,
`project-service.integration.spec.ts`, `api/v1/api.integration.spec.ts`,
`git.service.unit.spec.ts`.

## 3. Standalone / Docker

- `next.config.mjs` still has `output: 'standalone'`.
- Build produced `.next/standalone/server.js` (6439 bytes) plus `.next/standalone/*`.
- Docker image build **BLOCKED, not failed**: no container runtime present.

```sh
$ docker version
bash: docker: command not found   # exit 127
$ docker info
bash: docker: command not found   # exit 127
```

- Note: the `Dockerfile` deletes `./next/standalone` in the builder and the runner
  launches the custom server via `CMD … npm run start-prod` → `node dist/server.js`,
  so the image does not depend on the standalone server entrypoint. `dist/server.js`
  was produced by the build.
- PostCSS v4 resolution is proven locally: the build emitted
  `.next/static/css/app/layout.css` (144,469 bytes) containing **130 `oklch(`**,
  **76 `@property`**, **7 `@layer`**, sidebar tokens, `tw-animate-css` markers,
  and **0** occurrences of `@tailwind` / `hsl(var(`.

## 4. Dev-server smoke (best effort)

- `yarn dev` started; `✓ Ready in 1371ms`. Compiled `/middleware`, `/auth`,
  `/unauthorized`, `/_error` with no Tailwind/PostCSS compile errors.
- Routes: `/` → **307** redirect to `/api/auth/signin?callbackUrl=%2F`;
  `/auth` → **500**; `/unauthorized` → **500**.
- The 500s are environment-only, not UI/build breakage:
  - `Error: ENOENT: no such file or directory, open '/workspace/kube-config.config'`
    (`K3sApiAdapter.getKubeConfig`, `src/server/adapter/kubernetes-api.adapter.ts:52`) —
    k3s credentials required by `sidebar.tsx`/`layout.tsx` are absent.
  - `[next-auth][error][NO_SECRET]` when `NEXTAUTH_SECRET` is unset.
- Because every app route 500s before rendering, the linked stylesheet was not
  reachable via HTML; CSS emission was verified directly from the build output
  (section 3). Error fallback uses the Pages `/_error` page, which has no app CSS link.
- Server killed; **no background processes remain**, port 3000 free.

## Environment-only failures

1. `yarn test` — 5 k3s integration/unit suites: `Could not find a working container runtime strategy`.
2. Docker image build — `docker: command not found`.
3. Dev-server runtime routes — missing `/workspace/kube-config.config` (k3s) and `NEXTAUTH_SECRET`.

None of these are caused by the shadcn/Tailwind v4 change.

## Fixes made

None required. No in-scope breakages found; no source changes were made.

## Manual smoke checklist (human, with k3s + Docker + `NEXTAUTH_SECRET`)

- [ ] Dashboard / project overview loads with correct theme tokens.
- [ ] App-source wizard completes (forms, `multiselect-field`, validation).
- [ ] Terminal view (`xterm`) and pod-log views stream.
- [ ] Dialogs / sheets / drawers open, close, focus-trap (`dialog`, `sheet`, `drawer`).
- [ ] Sidebar collapse / icon mode toggles (`sidebar-*` tokens/`--sidebar-*`).
- [ ] Command palette (`cmdk`) opens and filters.
- [ ] Data tables sort, paginate, column toggle (`react-table`, `column-header`).
- [ ] Dark mode toggle + persistence (`next-themes`, `.dark` variant).
- [ ] Build the image from `Dockerfile` on a host with a container runtime; confirm PostCSS v4 is found and the container serves.

## Remaining uncertainty

- Docker/standalone image build and full k3s integration test run were **not executed**
  here; they must be run in a container-capable environment.
- Visual/interaction regression across screens is unverified automatically; the
  checklist above is required.
- Local Node is v24 vs Docker `node:22-alpine`; no v22-specific verification was done.
