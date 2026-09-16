# tooltip

2026-09-16, engine (legacy `new-york`: no base counterpart, so radix golden used only to detect customizations; transform ran on the project's own file keeping its classes), migrated the Tooltip wrapper and its consumers to Base UI.

## Changed

- `src/components/ui/tooltip.tsx`: `Tooltip` (radix) -> `@base-ui/react/tooltip`; `Provider` `delayDuration` -> `delay`; `Content` split into `Portal > Positioner > Popup` (positioner gets `isolate z-50`, `sideOffset` default kept at 0); `Arrow` kept as a rotated square with the base-registry per-side offsets; class mapping `origin-(--radix-tooltip-content-transform-origin)` -> `origin-(--transform-origin)`, `data-[state=open|closed]` -> `data-open|data-closed`.
- Consumer sweep (`asChild` -> `render`, `Tooltip delayDuration=N` -> `TooltipTrigger delay={N}`, `TooltipProvider delayDuration` -> `delay`; same-file/expression children moved into `render={... as React.ReactElement}`):
  `src/app/monitoring/app-monitoring.tsx`, `src/app/project/app/[appId]/general/app-rate-limits.tsx`, `src/app/project/app/[appId]/general/app-container-config.tsx`, `src/app/project/app/[appId]/credentials/db-gate-db-tool.tsx`, `src/app/project/app/[appId]/volumes/storages.tsx`, `src/app/project/app/[appId]/volumes/storage-edit-overlay.tsx`, `src/app/project/app/[appId]/overview/logs.tsx`, `src/app/project/app/[appId]/overview/monitoring-app.tsx`, `src/app/project/app/[appId]/advanced/network-policy.tsx`, `src/app/project/app/[appId]/advanced/basic-auth.tsx`, `src/app/project/agent/[agentId]/general/agent-network-policy-card.tsx`, `src/app/project/agent/[agentId]/general/agent-container-config-card.tsx`, `src/app/project/agent/[agentId]/sandboxes/agent-sandboxes-card.tsx`, `src/app/settings/users/users-table.tsx`, `src/app/settings/users/sso-providers-table.tsx`, `src/app/settings/server/k3s-update-info.tsx`, `src/app/settings/server/nodeInfo.tsx`, `src/components/custom/pod-status-indicator.tsx`, `src/components/custom/form-label-with-question.tsx`, `src/components/custom/hint-box-url.tsx`, `src/components/custom/domain-edit-overlay.tsx`, `src/components/custom/container-command-args-fields.tsx`, `src/components/ui/sidebar.tsx` (internal `TooltipTrigger`).
- Leftover scan: `grep -n "radix-ui\|@radix-ui"` over all files above returns no matches.

## Left alone

- `cmdk`, `vaul`, `sonner`, `react-day-picker`, `recharts` wrappers (not radix targets).
- `Tooltip` usages without `asChild`/`delayDuration` (e.g. `src/app/backups/backup-status-badge.tsx`): the wrapper API is source-compatible, so no edit was needed.

## Behavior changes

- Open delay now lives on `TooltipTrigger` (`delay`, Base UI default 600) instead of `Tooltip.Root`; every call site that set a root `delayDuration` was moved to the trigger, and `TooltipProvider` uses `delay`.
- `skipDelayDuration` concept is dropped (none used here); Base UI's grouping `timeout` remains available on the provider.
- Animation idiom is kept as `data-open/data-closed` + `animate-in/out` (matches the current base registry) rather than rewritten to `data-starting-style`.

## Verify by hand

- Hover CPU/RAM hints in Server settings (`nodeInfo`) and the volume badges in `storages`: tooltip appears next to the icon and the arrow points at the trigger on all four sides.
- Keyboard-focus the help icon in `form-label-with-question`: tooltip opens on focus and closes on blur/Escape.
- In the sidebar collapsed state, hover an item: tooltip opens to the right and hides when expanded/mobile.
- A tooltip wrapped around a `Link`/`div` (not a `Button`) still opens and does not swallow navigation.
