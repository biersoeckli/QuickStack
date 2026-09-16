# popover

2026-09-16, engine (legacy `new-york`, no base counterpart; classes preserved, radix-specific hooks remapped), migrated Popover to Base UI.

## Changed

- `src/components/ui/popover.tsx`: `Popover` (radix) -> `@base-ui/react/popover`; `Content` split into `Portal > Positioner > Popup`; `align` default `center`, `sideOffset` default kept at 4, `side` default `bottom`; class mapping `origin-(--radix-popover-content-transform-origin)` -> `origin-(--transform-origin)`, `data-[state=open|closed]` -> `data-open|data-closed`.
- Removed `PopoverAnchor`: Base UI has no anchor part (the `Positioner` takes an `anchor` prop instead) and the project has zero usages. Flagged, not silently dropped.
- `PopoverHeader`/`PopoverTitle`/`PopoverDescription` stay plain `div`/`div`/`p` (the project never used radix Title/Description primitives, so nothing to rewire).
- Consumers (`asChild` -> `render`):
  `src/app/project/app/[appId]/volumes/storage-edit-overlay.tsx`, `src/app/settings/profile/create-api-key-dialog.tsx`, `src/components/custom/storage-class-combobox.tsx`, `src/components/custom/multiselect-field.tsx`, `src/app/project/[projectId]/app-components/project-network-graph.tsx`.
- `multiselect-field.tsx` also maps `data-[state=open]:border-ring` -> `data-popup-open:border-ring` and `w-(--radix-popover-trigger-width)` -> `w-(--anchor-width)`.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in the files above.

## Left alone

- `PopoverAnchor` export removed (no Base UI equivalent, no consumers).
- `cmdk`/`vaul`/`sonner`/`recharts` wrappers untouched.

## Behavior changes

- `PopoverAnchor` is gone. If a future consumer needs detached-anchor positioning, use `PopoverPrimitive.Positioner anchor={...}` — it is not exposed by this wrapper yet.
- `openDelay`/`closeDelay` now belong on `PopoverTrigger`; none were used in the project.

## Verify by hand

- Open the access-mode popover in `storage-edit-overlay`: it anchors to the trigger, aligns to the chosen side, and closes on outside click/Escape.
- In `multiselect-field`, click the trigger: the popover opens and its width matches the trigger (`--anchor-width`), border highlight shows while open.
- `storage-class-combobox` and `create-api-key-dialog`: trigger button keeps its styles and the popover is correctly positioned.
