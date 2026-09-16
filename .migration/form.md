# form

2026-09-16, engine (legacy `new-york`, no base counterpart), removed the last radix `Slot` from the react-hook-form bridge.

## Changed

- `src/components/ui/form.tsx`: dropped `import { Slot }` and `import type { Label as LabelPrimitive } from "radix-ui"`. `FormControl` now uses `useRender` + `mergeProps<"div">` with the child element passed as `render`, injecting `id`, `aria-describedby` and `aria-invalid` (the radix `Slot` behaviour). `FormLabel` now types against the migrated native `Label` wrapper instead of the radix Label primitive.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in `form.tsx`.

## Left alone

- All ~45 `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` consumers needed no edits: the component names and props are unchanged and `FormControl` still clones onto its single child.
- `cmdk`/`vaul`/`sonner`/`recharts` untouched.

## Behavior changes

- `FormControl` merges props onto the child element via Base UI `mergeProps`; event handlers and `className`/`style` keep the same merge semantics as radix Slot. No visible change expected.

## Verify by hand

- Submit a form with an invalid field (login, register, 2FA): the label turns destructive, the message appears, and `aria-invalid`/`aria-describedby` land on the actual input.
- Confirm the field's `id` is still wired to the label and to `FormMessage` (clicking the label focuses the input).
- Select- and checkbox-based `FormControl` children still receive the injected ARIA attributes.
