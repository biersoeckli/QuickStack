# dialog

2026-09-16, engine (legacy `new-york`, no base counterpart), migrated Dialog (`radix-ui`) to Base UI Dialog.

## Changed

- `src/components/ui/dialog.tsx`: `Dialog` -> `@base-ui/react/dialog`; `Overlay` -> `Backdrop`, `Content` -> `Popup` (centred modal: no Positioner); `DialogClose` uses `render`; class mapping `data-[state=open|closed]` -> `data-open|data-closed`; kept the project's centred `translate-x/y-[-50%]`, sizing, borders and shadows.
- `DialogFooter`'s `Close asChild` -> `Close render={<Button variant="outline" />}`.
- Consumer sweep (`DialogTrigger asChild>{children}` -> `DialogTrigger render={children as React.ReactElement}`):
  `src/app/backups/backup-detail-overlay.tsx:72`, `src/app/project/app/[appId]/overview/logs-download-overlay.tsx:82`, `src/app/project/app/[appId]/overview/terminal-overlay.tsx:26`, `src/components/custom/input-dialog.tsx:123`.
- `src/components/ui/command.tsx`: `CommandDialog` now omits Base UI Dialog's payload-render `children` type (`Omit<React.ComponentProps<typeof Dialog>, "children"> & { children?: React.ReactNode }`).
- Leftover scan: no `radix-ui`/`@radix-ui` matches in the files above.

## Left alone

- The other ~40 Dialog consumers were not edited: `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` keep their names and props, and they used no `asChild` or focus/dismiss props.
- `src/components/ui/drawer.tsx` (vaul) untouched.

## Behavior changes

- Radix auto-focus/close-focus callbacks (`onOpenAutoFocus`, `onCloseAutoFocus`) would become `initialFocus`/`finalFocus` on the Popup; none are used in the project.
- Escape/outside dismissal is now reported through `onOpenChange(open, eventDetails)`; existing single-argument `onOpenChange` handlers remain valid.
- Base UI Portal adds a `<div>` wrapper; fixed-position content is unaffected.

## Verify by hand

- Open the Backup detail, Logs download, Terminal and Input dialogs: content is centred, the overlay dims, Escape and outside-click close them, and focus returns to the trigger.
- Confirm no console warning about a dialog without a title/description (all keep DialogTitle).
- Tab is trapped inside an open dialog and the close button dismisses it.
