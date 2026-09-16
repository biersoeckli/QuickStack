# tabs

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), tabs now wrap `@base-ui/react/tabs` (`Trigger` -> `Tab`, `Content` -> `Panel`) with class hooks rewritten to `data-active`; the Radix automatic-activation default is intentionally NOT preserved and is flagged.

## Changed

- `src/components/ui/tabs.tsx`: import switched from `{ Tabs as TabsPrimitive } from "radix-ui"` to `@base-ui/react/tabs`; prop types moved to `TabsPrimitive.Root.Props` / `.List.Props` / `.Tab.Props` / `.Panel.Props`; `TabsPrimitive.Trigger` -> `.Tab`, `TabsPrimitive.Content` -> `.Panel`. Class hooks `data-[state=active]:` -> `data-active:` (all occurrences, incl. the `variant=line` underline `after:opacity-100`), and `aria-disabled:pointer-events-none aria-disabled:opacity-50` was added next to the existing `disabled:` pair to match the base registry. `data-slot`, `tabsListVariants`, `data-orientation` hooks, and all layout classes are unchanged.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder" src/components/ui/tabs.tsx` returned no matches; `eslint` clean.
- No consumer call sites needed edits. All ten consumers pass `value` or `defaultValue` (`integration-tabs`-style callers in `app-tabs.tsx`, `network-policy.tsx`, `health-check-settings.tsx`, `agent-detail-client.tsx`, `node-details-drawer.tsx`, `project-overview.tsx`, `settings/users/page.tsx`, `settings/server/server-settings-tabs.tsx`, `settings/server/page.tsx`, `domain-edit-overlay.tsx`) plus `onValueChange` handlers that type as `(value) => …` and stay compatible.

## Left alone

- `src/app/project/[projectId]/app-components/project-overview.tsx` and the settings tab shells are consumers, not wrappers; only this wrapper changed.
- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.

## Behavior changes

- **Keyboard activation changed.** Radix defaults to `activationMode="automatic"` (arrow keys move focus AND switch the panel); Base UI defaults to MANUAL activation (arrow keys move focus, Enter/Space activates). No consumer sets `activationMode`, so every tab set now requires Enter/Space after arrowing. Flagged, not patched. To restore the old feel, add `<Tabs.List activateOnFocus>` (opt-in; deliberately not auto-added).
- Radix defaults to no active tab; Base UI activates value `0` (first tab) when uncontrolled. Every usage supplies `value`/`defaultValue`, so nothing changes here.
- State hooks renamed: `Tab` `data-state="active|inactive"` -> `data-active` presence; `Panel` `data-state="active|inactive"` -> `data-hidden` presence (inverted). Only this wrapper's classes styled those, and they were updated.

## Verify by hand

- Open Server Settings / Users / an app's tab shell; clicking each tab still switches panels and the active pill + line underline render correctly (default and `variant="line"`).
- Keyboard: focus a tab list, Arrow Left/Right moves focus; confirm the panel does NOT change until Enter/Space (new manual behavior), then decide whether to opt into `activateOnFocus`.
- Tab through the page; only the active panel should be reachable, with the same `flex-1 outline-none` layout and no leftover hidden panel taking space.
- Typeahead/none: verify `defaultValue` tabs (Users, Node details) still start on the expected tab.
