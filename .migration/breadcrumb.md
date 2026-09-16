# breadcrumb

2026-09-16, engine (legacy `new-york`, no base counterpart), removed the radix `Slot` from BreadcrumbLink using Base UI `useRender` + `mergeProps`.

## Changed

- `src/components/ui/breadcrumb.tsx`: dropped `Slot`/`--radix-*`; `BreadcrumbLink` now uses `useRender` with `defaultTagName: "a"`, `mergeProps<"a">`, a `render` prop and `state: { slot: "breadcrumb-link" }` (the worked-example pattern, avoiding the `mergeProps` data-* pitfall). Public API changes from `asChild?: boolean` to `render`, matching every other migrated wrapper.
- Consumer `src/components/custom/breadcrumbs-generator.tsx`: the conditional `DropdownMenuItem asChild={!item.active}` was rewritten to render a `disabled` item for the active crumb and `<DropdownMenuItem render={<Link .../>} />` for the rest.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in either file.

## Left alone

- The `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` parts were already plain elements.
- `cmdk`/`vaul`/`sonner`/`recharts` untouched.

## Behavior changes

- `BreadcrumbLink` no longer accepts `asChild`; use `render`. No consumer used `asChild` on it.
- The active crumb in the generator is a disabled `DropdownMenuItem` (same as before) while inactive crumbs render a real `<Link>`.

## Verify by hand

- Navigate to a nested route: the breadcrumb trail renders, the chevron separators show, and clicking an inactive dropdown crumb navigates.
- The current (active) crumb is disabled and not clickable; the dropdown still opens from the trigger.
