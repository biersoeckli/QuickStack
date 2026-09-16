# separator

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), Separator now renders the callable `@base-ui/react/separator` primitive and the Radix `decorative` prop is gone.

## Changed

- `src/components/ui/separator.tsx`: import switched from `{ Separator as SeparatorPrimitive } from "radix-ui"` to `@base-ui/react/separator`; dropped the `decorative` prop and `.Root`, used `SeparatorPrimitive.Props`, kept the `data-slot` and orientation classes verbatim.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder" src/components/ui/separator.tsx` returned no matches.
- No consumer call sites needed edits: all eight (`login-form.tsx`, `app-container-config.tsx`, `qs-system-backup-settings.tsx`, `settings/server/page.tsx`, `src/components/custom/breadcrumbs-generator.tsx`, `template-details-panel.tsx`, `update-info.tsx`, `node-details-drawer.tsx`) plus `src/components/ui/sidebar.tsx` pass only `className` / `orientation`.

## Left alone

- `src/components/ui/sidebar.tsx` still on Radix and still imports this separator; only the separator wrapper itself changed.
- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.

## Behavior changes

- `decorative` is dropped (no Base UI equivalent). Radix defaulted to `decorative={true}`, which rendered `role="none"`; Base UI's separator is always semantic and renders `role="separator"`. Every purely visual divider in the app therefore gains an implicit separator role in the accessibility tree. Flagged, not patched. If `role="none"` is wanted, render a plain `<div aria-hidden>` at the call site.
- No consumer passed `decorative`, so no call site breaks.

## Verify by hand

- Open the login form and the server settings page; horizontal rules should render with the same 1px `border` color and spacing.
- Check the vertical separator in the breadcrumb trail has the same height/width.
- Screen reader (or DOM inspector): confirm separators now expose `role="separator"`, and decide whether any purely decorative one should lose it.
