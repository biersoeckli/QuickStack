# checkbox

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), Checkbox now wraps `@base-ui/react/checkbox`; the one `checked="indeterminate"` call site was split into the Base UI `indeterminate` prop.

## Changed

- `src/components/ui/checkbox.tsx`: import switched from `{ Checkbox as CheckboxPrimitive } from "radix-ui"` to `@base-ui/react/checkbox`; prop type moved to `CheckboxPrimitive.Root.Props`; class hooks rewritten `data-[state=checked]:` -> `data-checked:`, and the dead `disabled:` variants (Root is now a `<span>`, not a `<button>`) replaced with `data-disabled:`. The `Indicator` part, `data-slot`s, and icon are unchanged.
- `src/components/custom/simple-data-table.tsx:185`: header "select all" checkbox converted from `checked={all || (some && "indeterminate")}` to `checked={table.getIsAllPageRowsSelected()}` plus `indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}`. `onCheckedChange` still receives a boolean, so `!!value` is unchanged.
- Other consumers (`checkbox-form-field.tsx`, `user-group-edit-overlay.tsx`, `user-edit-overlay.tsx`, `s3-target-edit-overlay.tsx`, `domain-edit-overlay.tsx`) pass only boolean `checked`/`onCheckedChange`/`disabled` and needed no edits.
- Leftover scan clean and `eslint` clean on both touched files.

## Left alone

- `checkbox-form-field.tsx` uses the migrated wrapper as-is; no Radix import there.
- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.

## Behavior changes

- Radix allowed `checked="indeterminate"`; Base UI models the mixed state with a separate `indeterminate` boolean (and `checked` stays boolean). The one usage was migrated; any future code must use `indeterminate`.
- Root element changed from `<button>` to `<span>` (Base UI adds a hidden `<input>` in forms). The `disabled:` Tailwind variants were therefore dead and were swapped to `data-disabled:`; visual result is the same.
- `onCheckedChange` gained an `eventDetails` second argument. Existing single-arg handlers are unaffected.

## Verify by hand

- Open a data table with row selection; the header checkbox should show the mixed (`indeterminate`) dash when some rows are selected, checked when all are, and unchecked when none.
- Click a row checkbox and toggle all; selection callbacks should still fire.
- In Users / S3 targets / Domains forms, toggle a checkbox and confirm it still submits and shows the disabled state (cursor/opacity) correctly.
- Tab to a checkbox and press Space; verify it toggles and the focus ring renders.
