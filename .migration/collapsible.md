# collapsible

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), Collapsible parts now wrap `@base-ui/react/collapsible` (`Content` -> `Panel`) and the one consumer moved from `asChild` to `render`.

## Changed

- `src/components/ui/collapsible.tsx:3`: import switched from `radix-ui` to `@base-ui/react/collapsible`; `CollapsiblePrimitive.CollapsibleTrigger` -> `.Trigger` and `CollapsiblePrimitive.CollapsibleContent` -> `.Panel`. Exported names (`Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`) are unchanged.
- `src/app/project/app/[appId]/general/app-source-wizard/framework-configuration-step.tsx:45`: `<CollapsibleTrigger asChild><Button …>…</Button></CollapsibleTrigger>` -> `<CollapsibleTrigger render={<Button … />}>…</CollapsibleTrigger>`; the chevron open style moved from `group-data-[state=open]:rotate-180` to `group-data-[panel-open]:rotate-180` because Base UI's trigger exposes `data-panel-open`, not `data-state=open`.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder"` on both files returned no matches.

## Left alone

- The only consumer is the framework configuration step above; it was migrated with the wrapper.
- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.

## Behavior changes

- Panel open/closed hooks renamed: `Content`/`Root` `data-state="open|closed"` -> `Panel` `data-open` / `data-closed`, and `Trigger` `data-state="open"` -> `data-panel-open`. The consumer's chevron was updated; no other code styles these.
- No callback or prop changes were needed (no consumer uses `onOpenChange`/`forceMount`/controlled `open`).

## Verify by hand

- Open the app-source wizard's Framework Configuration step and click "Build details"; the panel should expand/collapse and the chevron should rotate 180deg while open.
- Tab to the trigger and press Enter/Space; it should toggle and keep a visible focus ring (the Button focus styles).
- Confirm the collapsed panel is removed from layout (no empty gap) and the grid inside keeps its two-column layout when open.
