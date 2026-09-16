# scroll-area

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), ScrollArea now wraps `@base-ui/react/scroll-area` with `Scrollbar` / `Thumb` part renames and no class changes.

## Changed

- `src/components/ui/scroll-area.tsx`: import switched from `{ ScrollArea as ScrollAreaPrimitive } from "radix-ui"` to `@base-ui/react/scroll-area`; `Root`/`Viewport`/`Corner` unchanged, `ScrollAreaScrollbar` -> `Scrollbar`, `ScrollAreaThumb` -> `Thumb`; prop types moved to `ScrollAreaPrimitive.Root.Props` / `.Scrollbar.Props`. The local `ScrollBar` export and all class strings are unchanged.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder" src/components/ui/scroll-area.tsx` returned no matches; `eslint` clean.
- No consumer call sites needed edits. All usages (17 files, incl. `ScrollBar orientation="horizontal"` in `app-action-buttons.tsx`, `app-tabs.tsx`, `node-details-drawer.tsx`, `settings/server/page.tsx`) pass only `className` / `orientation` / children.

## Left alone

- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.
- Base UI's optional `ScrollArea.Content` wrapper was not added: the shadcn base registry omits it too, and the existing vertical/horizontal usages work without it.

## Behavior changes

- Radix `type` (`"hover"` default) is dropped; Base UI mounts the scrollbar whenever the viewport is scrollable and leaves visibility to CSS. The wrapper styles no `[data-hovering]`/`[data-scrolling]` opacity, so the thin scrollbar is now visible at rest instead of appearing on hover. Flagged, not patched. To restore hover-only reveal, add `transition-opacity` + opacity classes driven by `data-hovering` / `data-scrolling` on the Scrollbar.
- Radix `data-state="visible|hidden"` on the scrollbar is gone (Base UI uses `data-hovering`, `data-scrolling`, `data-has-overflow-x/y`). No app code styles against it.
- `scrollHideDelay`, `dir`, and `nonce` were dropped; none are used by the app.

## Verify by hand

- Open Server Settings and Users/Backups overlays; content taller than the box should scroll and show the thin `border` scrollbar.
- Open a horizontally scrollable tab strip (`app-tabs`, `app-action-buttons`, node details) and confirm the horizontal scrollbar still appears and drags.
- Mouse-wheel and trackpad-scroll a long list; confirm no double scrollbars and that `rounded-[inherit]` clipping still matches the container.
- Keyboard: focus the viewport and page through with arrows/Space; confirm focus ring and wheel-scroll behavior.
