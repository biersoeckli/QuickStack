# button

2026-09-16, engine, migrated the customized legacy Button wrapper to Base UI while retaining its variants and styling.

## Changed

- src/components/ui/button.tsx:2 and :40 replaced the Radix Slot/asChild composition with the Base UI Button primitive and its render prop; existing CVA variants and classes remain intact.
- src/components/ui/alert-dialog.tsx:155 and :177 converted Button consumer composition from asChild to render.
- src/app/settings/server/cluster-addon-update-info.tsx:117 and src/app/project/[projectId]/template-details-panel.tsx:54 converted link buttons from asChild to render.
- package.json and yarn.lock add @base-ui/react alongside radix-ui for this progressive migration.
- Leftover scan clean: `grep -n "radix-ui\\|@radix-ui" src/components/ui/button.tsx` returned no matches.

## Left alone

- src/components/ui/alert-dialog.tsx remains Radix-backed; only its Button call sites changed, so it continues to compose the migrated wrapper correctly.
- cmdk, vaul, sonner, input-otp, react-day-picker, and recharts wrappers were not touched because they are not Radix migration targets.

## Behavior changes

- Button polymorphism now uses Base UI's `render` prop. Existing `asChild` call sites were converted; no visual or interaction change is expected.

## Verify by hand

- Click the Documentation and Open website buttons; each should navigate correctly and retain its styles.
- Open an alert dialog, then confirm and cancel it; buttons should be focusable, styled, and close the dialog.
- Tab to a disabled and an enabled button; verify the enabled button gets the focus ring and disabled button cannot be activated.
