# avatar

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), Avatar/Image/Fallback now wrap `@base-ui/react/avatar` with identical anatomy and classes.

## Changed

- `src/components/ui/avatar.tsx`: import switched from `{ Avatar as AvatarPrimitive } from "radix-ui"` to `@base-ui/react/avatar`; prop types moved from `React.ComponentProps<typeof AvatarPrimitive.*>` to `AvatarPrimitive.Root.Props` / `.Image.Props` / `.Fallback.Props`. Classes, `data-slot`, the local `size` prop, and the `data-size` group hooks are unchanged. `AvatarBadge`/`AvatarGroup`/`AvatarGroupCount` were already plain elements and were not touched.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder" src/components/ui/avatar.tsx` returned no matches.
- No consumer call sites needed edits. The only consumer, `src/app/sidebar-client.tsx:334`, uses `<Avatar>` + `<AvatarFallback>` with `className` only.

## Left alone

- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.
- `AvatarImage`/`AvatarBadge`/`AvatarGroup`/`AvatarGroupCount` have no consumers today and were migrated/reported anyway to keep the module whole.

## Behavior changes

- None observable at the call site. `Avatar.Fallback`'s `delayMs` was renamed to `delay` in Base UI; the app never passes it, so nothing breaks. Anyone adding `delayMs` later must use `delay`.

## Verify by hand

- Open the sidebar while signed in; the user avatar circle should keep its rounded shape, size, and the fallback initial.
- Force an avatar image to fail/load slowly and confirm the fallback still appears without layout shift.
- Confirm the avatar group overlap (if any usage appears) still renders with the ring spacing.
