# project (whole-project radix -> Base UI migration)

2026-09-16, whole-project, legacy `new-york` style. All radix primitive imports were removed from `src/`; `radix-ui` and `@radix-ui/react-icons` were removed from `package.json` and the lockfile updated.

## Dependency swap

- Removed: `radix-ui@^1.6.7`, `@radix-ui/react-icons@^1.3.2` (`package.json`, `yarn.lock`, `yarn install`).
- Kept: `@base-ui/react@^1.8.0`.
- `vaul` still brings in `@radix-ui/react-dialog` transitively; that is the untouched drawer library, not a direct dependency.

## Per-component work (this run)

Wrappers migrated with the transformation engine (legacy style, classes preserved, radix hooks remapped):
`tooltip`, `popover`, `hover-card`, `dropdown-menu`, `select`, `sheet`, `dialog`, `alert-dialog`, `breadcrumb`, `form`, `sidebar`.
Project components swept as consumers: `column-header`, `column-toggle`, `pagignation`.

The ten previously migrated wrappers (`button`, `label`, `avatar`, `separator`, `progress`, `collapsible`, `checkbox`, `switch`, `scroll-area`, `tabs`) were left as-is and their reports were not touched.

## App-code sweep summary

- `asChild` -> `render` across every consumer (a TypeScript-AST codemod plus manual handling of `{children}` and `renderAccessButton(...)` expressions and the conditional `DropdownMenuItem`).
- `Tooltip delayDuration` -> `TooltipTrigger delay`; `TooltipProvider delayDuration` -> `delay`.
- Menu items: radix `onSelect` -> `onClick` (`node-details-drawer`, `deployments-default-view`, `deployments-grid-view`); `DropdownMenuLabel` wrapped in `DropdownMenuGroup` at six call sites; open-state hooks `data-[state=open]` -> `data-popup-open`; `--radix-popper-anchor-width` -> `--anchor-width`; `--radix-popover-trigger-width` -> `--anchor-width`; tabs `data-[state=active]` -> `data-active` (stale from the earlier tabs migration).
- `@radix-ui/react-icons` -> `lucide-react` in 11 files; `globals.css` accordion keyframes renamed to `--accordion-panel-height` (the CSS is unused: the project ships no accordion wrapper).
- Removed stale radix runtime attributes (`id="radix-:reh:"`, `aria-haspopup`, `aria-expanded`, `data-state`, `control-id`) copied into `nav-bar.tsx`.
- Final grep: `grep -rn "radix-ui\|@radix-ui" src` returns **zero** matches.
- Remaining wrappers on Radix: **0** (derived from `src/components/ui`).

## Build / verify

- Baseline: `tsc --noEmit` green; `yarn build` failed only at page-data collection with `DATABASE_URL is not defined` (pre-existing env requirement).
- Final: `npx tsc --noEmit` **0 errors**; `yarn lint` **0 errors** (the same 2 pre-existing warnings); `DATABASE_URL="file:/tmp/opencode/build-verify.db" yarn build` **succeeds** (Next build + server `tsc` + `tsc-alias`).
- Unit tests (`DATABASE_URL=... npx vitest run --project jsdom`): 705 passed, 11 skipped, 2 failed. Both failures are in `src/app/settings/server/server-settings-tabs.unit.spec.ts` and are **pre-existing from the earlier `tabs` migration** (commit `f76e3df`, not part of this run): Base UI keeps inactive panels mounted and uses click/pointer activation, while the test expects radix unmount-on-inactive and `mouseDown`. They are not caused by these changes.
- `node-integration` tests were not run (they require k3s/testcontainers).

## Flaggable gaps / untouched

- `components.json` still reads `"style": "new-york"` (a legacy radix style). There is no `base-new-york`, so it was **not** flipped: future `shadcn add` will still emit radix variants until the project switches style or adds components manually. This is a decision for the maintainers.
- No Base UI counterpart: `PopoverAnchor` (removed, no consumers), Label (native `<label>`, already migrated), AspectRatio/VisuallyHidden/Direction (not used).
- Behaviour deltas flagged, not patched: menu Checkbox/Radio items no longer auto-close; `AlertDialogAction` no longer auto-closes; Menu `GroupLabel` now requires a `Group`.
- Intentionally untouched non-radix libraries: `cmdk` (command), `vaul` (drawer), `sonner`, `react-day-picker` (calendar), `recharts` (chart).
