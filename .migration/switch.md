# switch

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), Switch and Thumb now wrap `@base-ui/react/switch` with the same track/thumb classes and local `size` prop.

## Changed

- `src/components/ui/switch.tsx`: import switched from `{ Switch as SwitchPrimitive } from "radix-ui"` to `@base-ui/react/switch`; prop type moved to `SwitchPrimitive.Root.Props`. Class hooks rewritten on Root (`data-[state=checked]:` -> `data-checked:`, `data-[state=unchecked]:` -> `data-unchecked:`) and on Thumb (same), and the dead `disabled:` variants (Root is now a `<span>`) replaced with `data-disabled:`. The `data-size` group classes, local `size` prop, `data-slot`s, and thumb transition are unchanged.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder" src/components/ui/switch.tsx` returned no matches; `eslint` clean.
- No consumer call sites needed edits. Fourteen usages (`app-container-config.tsx`, `phpmyadmin-db-tool.tsx`, `db-gate-db-tool.tsx`, `app-network-policy-rule-section.tsx`, `network-policy.tsx`, `health-check-settings.tsx`, `agent-network-policy-card.tsx`, `agent-container-config-card.tsx`, `sso-provider-edit-overlay.tsx`, `qs-version-info.tsx`, `rest-api-settings.tsx`, `qs-traefik-settings.tsx`, `traefik-ip-propagation-card.tsx`, `longhorn-ui-toggle.tsx`) pass only `checked` / `onCheckedChange` / `disabled` / `id` / `className` (plus two async handlers, which are signature-compatible).

## Left alone

- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.

## Behavior changes

- Root element changed from `<button>` to `<span>` (Base UI adds a hidden `<input>` for form submission). The `disabled:` Tailwind variants were dead on the new element and were swapped to `data-disabled:`; visuals are unchanged.
- `onCheckedChange` gained an `eventDetails` second argument. The async single-arg handlers in the DB tool cards ignore it and keep working.
- `data-state="checked|unchecked"` hooks become `data-checked` / `data-unchecked` presence attributes. Only this wrapper's own classes used them, and both were updated.

## Verify by hand

- Toggle a few switches: REST API setting, Traefik settings, canary DB tools, Longhorn UI, and a network-policy rule. Each should flip and persist.
- Confirm the thumb travel and primary/input track colors are unchanged in light and dark mode.
- Disable a switch (`disabled={loading}` in the DB tool cards) and confirm it is unclickable and shows reduced opacity; keyboard focus should skip it.
- Tab to an enabled switch and press Space/Enter to toggle.
