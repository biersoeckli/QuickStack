# sheet

2026-09-16, engine (legacy `new-york`, no base counterpart), migrated the Dialog-based Sheet wrapper (`radix-ui` Dialog) to Base UI Dialog.

## Changed

- `src/components/ui/sheet.tsx`: `SheetPrimitive` -> `@base-ui/react/dialog`; `Overlay` -> `Backdrop`, `Content` -> `Popup`; `Close` uses `render`; `data-slot` kept. Animations restated as CSS transitions using `data-starting-style` / `data-ending-style` with per-side `translate-x/y-full` and opacity, preserving the original open/close durations (`duration-500` opening, `duration-300` closing) and per-side borders/widths.
- Consumer `src/components/ui/sidebar.tsx`: mobile sidebar `<Sheet>` now uses the migrated wrapper; `data-[state=open]` close-button hook -> `data-open`.
- Consumer `src/app/monitoring/monitoring-nodes.tsx`: `SheetTrigger asChild` -> `render`.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in `sheet.tsx`, `sidebar.tsx`, `monitoring-nodes.tsx`.

## Left alone

- `src/components/ui/drawer.tsx` (vaul) is intentionally untouched: vaul is not radix, even though it transitively pulls `@radix-ui/react-dialog`.

## Behavior changes

- Slide animation now uses `data-starting-style`/`data-ending-style` transitions instead of `data-state` keyframes; visually equivalent (full-width slide from the given side, fade on the backdrop).
- Base UI Portal renders an extra `<div>` wrapper (radix Portal did not); no layout impact for the fixed sheet.

## Verify by hand

- Resize below `md` and open the sidebar: it slides in from the left, the backdrop fades, and the close button (when shown) dismisses it.
- Open the "Add cluster node" sheet (`monitoring-nodes`) from the right and confirm it closes on Escape and outside click.
- Confirm body scroll is locked while a sheet is open and restored after close.
