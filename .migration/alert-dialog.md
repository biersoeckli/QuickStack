# alert-dialog

2026-09-16, engine (legacy `new-york`, no base counterpart), migrated AlertDialog (`radix-ui`) to Base UI Alert Dialog.

## Changed

- `src/components/ui/alert-dialog.tsx`: `AlertDialog` -> `@base-ui/react/alert-dialog`; `Overlay` -> `Backdrop`, `Content` -> `Popup`; `Cancel` -> `Close` with `render={<Button/>}`; `Action` has no Base UI primitive so it is now the styled `Button` with `data-slot="alert-dialog-action"` (base-registry shape); class mapping `data-[state=open|closed]` -> `data-open|data-closed`. The previous file had a half-applied composition (`<Button render={<AlertDialogPrimitive.Action/>} />`) which is replaced by the idiomatic shape.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in `alert-dialog.tsx`.

## Left alone

- No consumers import `@/components/ui/alert-dialog` (confirmed by grep), so no call-site edits.
- `cmdk`/`vaul`/`sonner`/`recharts` untouched.

## Behavior changes

- `AlertDialogAction` no longer closes the dialog automatically: radix `Action` closed on press, Base UI has no Action primitive. A consumer that needs close-on-action must compose `AlertDialogCancel`/controlled `open` or call `actionsRef.close()`. No current consumer uses it, so nothing is broken today — flagged for future use.
- Radix focused `Cancel` first by default; Base UI focuses the first tabbable element. Pass `initialFocus` if the old behaviour is required.

## Verify by hand

- Open any confirm dialog built on this wrapper: overlay dims, Escape/outside click do not dismiss (alert-dialog semantics), Cancel closes.
- `AlertDialogCancel` renders as an outline button and closes; a future `AlertDialogAction` button performs its action but does not close on its own.
