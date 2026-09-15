# UI Component Inventory

Ticket: `02 — UI-Komponenten inventarisieren`

Classification of every file in `src/components/ui/` against the shadcn registry
(`https://ui.shadcn.com/r/styles/new-york/<name>.json`), so later registry re-adds can be
merged without losing local work.

## Categories

- **upstream** — unmodified (or near-unmodified) shadcn registry component. Safe to re-add.
- **upstream (stale)** — older registry version; only version drift. Safe to re-add, but confirm
  the drift is acceptable.
- **modified** — upstream component with meaningful local QuickStack changes. Merge carefully.
- **project** — QuickStack-only file, no registry counterpart. Never overwrite.

Alias/path differences (`@/frontend/utils/utils` vs `@/lib/utils`,
`@/components/ui/*` vs `@/registry/new-york/ui/*`), Radix import style
(`@radix-ui/react-*` vs unified `radix-ui`), `forwardRef` vs React 19 ref-as-prop, and
Tailwind v3 vs v4 class drift are **not** counted as local deviations.

## Inventory

| File | Category | Upstream name | Local deviations (short) |
| --- | --- | --- | --- |
| alert-dialog.tsx | upstream (stale) | alert-dialog | None meaningful; only cn import path + a double space. Older classes. |
| alert.tsx | upstream (stale) | alert | None meaningful; class list reordered (`px-4 py-3 text-sm` drift). |
| avatar.tsx | upstream | avatar | None (identical modulo cn alias). |
| breadcrumb.tsx | upstream | breadcrumb | None. |
| button.tsx | upstream (stale) | button | None meaningful; older size scale (`h-10` default vs `h-9`) and no per-variant shadows. |
| calendar.tsx | upstream (stale) | calendar | None meaningful; react-day-picker v8 API (`IconLeft`/`IconRight`); upstream now v9 (`getDefaultClassNames`, `DayButton`, `CalendarDayButton`). |
| card.tsx | upstream (stale) | card | None meaningful; older markup (`h3`/`p`, `text-2xl`, `rounded-lg`, `shadow-sm`). |
| chart.tsx | upstream (stale) | chart | None meaningful; explicit local prop types instead of Recharts inference; missing `item.type !== "none"` payload filter. |
| checkbox.tsx | upstream (stale) | checkbox | None meaningful; older classes (no `shadow`/`ring-1`, indicator layout). |
| collapsible.tsx | upstream | collapsible | None. |
| column-header.tsx | project | — | TanStack `DataTableColumnHeader` (sort + filter dropdown). No registry item. |
| column-toggle.tsx | project | — | TanStack `DataTableViewOptions` (show/hide columns). No registry item. |
| command.tsx | upstream (stale) | command | None meaningful; local `CommandDialogProps` interface + `DialogContent` `shadow-lg`; upstream removed both. |
| dialog.tsx | upstream | dialog | None meaningful; export order only. |
| drawer.tsx | modified | drawer | Four-direction layout (top/bottom/left/right), handle bar removed, `!select-text` added. |
| dropdown-menu.tsx | upstream (stale) | dropdown-menu | None meaningful; content missing `origin-[…]` + available-height/overflow classes. |
| empty.tsx | upstream | empty | None meaningful; import order only. |
| form.tsx | upstream (stale) | form | None meaningful; older context defaults (no null guard, `{} as`), message `text-sm` vs `text-[0.8rem]`. |
| full-loading-spinnter.tsx | project | — | Wraps `LoadingSpinner` in a centered flex container. Note filename typo `spinnter`. |
| hover-card.tsx | upstream (stale) | hover-card | None meaningful; missing `origin-[--radix-hover-card-content-transform-origin]`. |
| input.tsx | upstream (stale) | input | None meaningful; older `h-10` / `bg-background` / `ring-2` scale. |
| item.tsx | modified | item | Full local rewrite: adds `size: "xs"`, drops `data-slot`/`asChild`/`ItemHeader`/`ItemFooter`/`ItemSeparator`; different variant styles/API. |
| label.tsx | upstream | label | None. |
| loading-spinner.tsx | project | — | Custom inline SVG spinner (no registry counterpart). |
| pagignation.tsx | project | — | TanStack `DataTablePagination`. Note filename typo `pagignation`. |
| popover.tsx | upstream (stale) | popover | None meaningful; missing `PopoverAnchor` export and `origin-[…]` class. |
| progress.tsx | modified | progress | Adds `color` prop (`"blue" \| "green" \| "red" \| "orange" \| "default"`) mapped to indicator classes. |
| scroll-area.tsx | upstream | scroll-area | None. |
| select.tsx | upstream (stale) | select | None meaningful; older trigger (`h-10`, `ring-2`) and item indicator on the left. |
| separator.tsx | upstream | separator | None. |
| sheet.tsx | upstream (stale) | sheet | None meaningful; `{children}`/Close DOM order differs and whitespace. |
| sidebar.tsx | upstream (stale) | sidebar | None meaningful; cookie `sidebar:state` (upstream `sidebar_state`), no sr-only mobile `SheetHeader`, class reorder. |
| skeleton.tsx | upstream (stale) | skeleton | `bg-muted` (upstream `bg-primary/10`). |
| sonner.tsx | upstream | sonner | None. |
| spinner.tsx | upstream | spinner | None meaningful; import order only. |
| switch.tsx | upstream (stale) | switch | None meaningful; older `h-6 w-11` track + `h-5 w-5` thumb. |
| table.tsx | upstream (stale) | table | None meaningful; older `h-12` / `px-4` / `p-4` sizing. |
| tabs.tsx | upstream (stale) | tabs | None meaningful; older `h-10` / `rounded-sm` scale. |
| textarea.tsx | upstream (stale) | textarea | None meaningful; exports local `TextareaProps`, older `min-h-[80px]` / `bg-background`. |
| tooltip.tsx | upstream (stale) | tooltip | None meaningful; no `TooltipPrimitive.Portal`, `bg-popover` instead of `bg-primary`. |

## Counts

| Category | Count |
| --- | --- |
| upstream | 10 |
| upstream (stale) | 22 |
| modified | 3 |
| project | 5 |
| **Total** | **40** |

## Do not overwrite

These files have no registry counterpart. Re-adding will never produce them and
`--overwrite` would delete them.

- `column-header.tsx` — TanStack `DataTableColumnHeader`.
- `column-toggle.tsx` — TanStack `DataTableViewOptions`.
- `full-loading-spinnter.tsx` — centered `LoadingSpinner` wrapper.
- `loading-spinner.tsx` — custom inline SVG spinner.
- `pagignation.tsx` — TanStack `DataTablePagination`.

## Merge carefully

Registry re-adds must preserve the following local behavior.

- `drawer.tsx`
  - Preserve the four `data-[vaul-drawer-direction=...]` groups (top/bottom/right/left); upstream
    ships a bottom-only layout.
  - Keep the handle bar removed.
  - Keep `!select-text` on `DrawerContent` (allows text selection inside the drawer).
- `progress.tsx`
  - Preserve the `color` prop and `colorClasses` (`blue`, `green`, `red`, `orange`, `default`).
  - Consumed by `src/app/project/app/[appId]/volumes/storages.tsx` and
    `src/app/monitoring/app-volumes-monitoring.tsx` (red ≥ 90, orange ≥ 80).
- `item.tsx`
  - Preserve the entire local API: `Item`, `ItemGroup`, `ItemMedia`, `ItemContent`, `ItemTitle`,
    `ItemDescription`, `ItemActions`, plus the `size: "xs"` option.
  - Upstream `item` is a different component (`data-slot`, `asChild`, `ItemHeader`,
    `ItemFooter`, `ItemSeparator`, no `xs`); do not blindly replace.
  - Consumed by `node-details-drawer.tsx` and `deployments-grid-view.tsx`.
