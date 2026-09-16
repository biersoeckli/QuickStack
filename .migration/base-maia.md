# base-maia restyle

2026-09-16, whole-project, strategy: shadcn CLI golden-pair (preset `maia`, base UI, icons resolved to `lucide`), plus replay of local QuickStack customizations. Verdict: all UI wrappers restyled including the previously excluded `item`/`drawer`/`command`/`sonner`/`calendar`/`chart`; typecheck + lint green.

## Changed

- `components.json`: `style` `new-york` -> `base-maia`; added `iconLibrary: "lucide"`, `menuColor: "default"`, `menuAccent: "subtle"`, `rtl: false`; aliases/utils kept (`@/frontend/utils/utils`). `shadcn info` now reports `base: base`, `style: maia`.
- `src/app/globals.css`: added `@import "shadcn/tailwind.css"` (defines the `data-open/closed/checked/...` custom variants the Maia classes rely on) and `--font-heading: var(--font-sans)` in `@theme inline`. The neutral tokens and the extended radius scale (`--radius-sm..4xl`) were already present from the Tailwind v4 upgrade.
- Regenerated from base-maia via `shadcn add <component> --overwrite` (one registry golden each, icons/aliases resolved by the CLI):
  `button`, `label`, `input`, `textarea`, `separator`, `card`, `skeleton`, `spinner`, `avatar`, `checkbox`, `switch`, `table`, `tabs`, `collapsible`, `empty`, `scroll-area`, `breadcrumb`, `alert`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `select`, `tooltip`, `popover`, `hover-card`, `sidebar`, `form`.
- Second batch (previously excluded, now ported from base-maia): `item`, `sonner`, `chart`, `calendar`, `command` (+ new `input-group` dependency), `drawer`.
  - `item.tsx` -> registry Maia item (superset API: `variant default|outline|muted`, `size default|sm|xs`, plus `ItemHeader`/`ItemFooter`/`ItemSeparator`); existing custom consumers (`deployments-grid-view`, `node-details-drawer`) compile unchanged.
  - `drawer.tsx` -> `@base-ui/react/drawer` (was `vaul`). `vaul` removed from `package.json`/lockfile. Consumer `node-details-drawer.tsx` adapted: `direction="right"` -> `swipeDirection="right"`, `dismissible={false}` -> `disablePointerDismissal`, `data-[vaul-drawer-direction=right]:*` -> `data-[swipe-direction=right]:*`.
  - `command.tsx` -> Maia cmdk command using the new `InputGroup`; command consumers (`git-branch-step`, `build-method-step`, `storage-edit-overlay`, `storage-class-combobox`, `multiselect-field`) compile unchanged.
  - `calendar.tsx` -> Maia react-day-picker wrapper (v10 API); consumer `create-api-key-dialog` unchanged.
  - `chart.tsx` -> Maia recharts wrapper; `recharts` pinned to the registry's `3.8.0`. Consumers `disk-chart`/`monitoring-nodes` unchanged.
  - `sonner.tsx` -> Maia Toaster; consumer `layout.tsx` unchanged.
- `scroll-area.tsx`: added the missing `<ScrollArea.Content>` inside the Viewport. The base-maia golden omits it, but Base UI's Content wrapper is what sets `min-width: fit-content`; without it horizontal overflow is never detected and horizontal scrollbars/scroll never activate. Confirmed the wrapper is otherwise byte-identical to the current `base-maia/scroll-area` golden (so the newest component is installed).
- Replayed local customizations:
  - `progress.tsx`: restored the `color` prop (`blue | green | red | orange | default`) onto the Maia multi-part Progress; it now feeds `ProgressIndicator`.
  - `sidebar.tsx`: `useIsMobile` import repointed to `@/frontend/hooks/use-mobile`.
  - Removed the stray `src/hooks/use-mobile.ts` the CLI created.
- Leftover scan: no `radix-ui`/`@radix-ui` in `src`; no `--radix-*` in `src/components/ui`; `vaul` gone. `@radix-ui/react-dialog` remains only transitively via `cmdk` (third-party).

## Left alone

- Local custom components (not registry items, API preserved): `column-header.tsx`, `column-toggle.tsx`, `pagignation.tsx`, `loading-spinner.tsx`, `full-loading-spinnter.tsx`. They consume the restyled primitives and typecheck unchanged; their own class strings are intentionally not restyled.
- `command.tsx` still wraps `cmdk`, which transitively depends on `@radix-ui/react-dialog`; replacing cmdk itself is out of scope.
- `shadcn/tailwind.css` is imported from the installed `shadcn` devDependency; no new runtime dependency was added.

## Behavior / visual changes

- Maia look: buttons/selects/inputs are pill-shaped (`rounded-4xl`), menus/dialogs use larger radii (`rounded-2xl`/`rounded-4xl`), softer `ring-foreground/5`, and the `destructive` button variant is now a soft red tint instead of solid red.
- `button.tsx` no longer emits `data-variant`/`data-size` (base-maia dropped them); no consumer relied on them.
- New theme token `--font-heading`; base-maia headings (e.g. DialogTitle) use it.
- Progress markup is the Maia multi-part shape (Root > Track > Indicator, `h-3`/`bg-muted`); the `color` prop is preserved but bar height/muted track changed from the new-york look.
- Menu/dialog open-close animations now resolve through `shadcn/tailwind.css` custom variants, so `data-open:`/`data-closed:` classes actually generate (previously the bare `data-open:` variant had no definition).
- Known registry quirk left as-is: `tooltip.tsx` carries a dead `data-[state=delayed-open]` variant from the golden; harmless.
- `drawer.tsx` is now Base UI (swipe-to-dismiss, nested-drawer stacking, snap points, rounded popover card). `node-details-drawer` keeps its non-modal right panel; vaul's `dismissible={false}` maps to `disablePointerDismissal`.
- `item.tsx` is now the registry API (adds `ItemHeader`/`ItemFooter`/`ItemSeparator`, `size` gains `sm`); existing `size="xs"` usages keep working.
- `calendar.tsx` uses the react-day-picker v10 API (we already had v10 installed); `chart.tsx` uses recharts pinned to `3.8.0`; `sonner.tsx` icons are lucide.
- Horizontal `ScrollArea` now scrolls (`scroll-area` gained `Content`); affected usages: `app-tabs`, `app-action-buttons`, `settings/server/page`, `node-details-drawer`.

## Verify by hand

- Global: run `yarn dev`; check Light + Dark. Sidebar collapsed/expanded/mobile (mobile uses the Sheet), nav-bar user menu.
- Buttons: primary/outline/secondary/ghost/destructive/link + `xs/sm/lg/icon` sizes on `projects-table`, dialogs, `settings`.
- Forms: `settings/server` build settings, login/register, project app general — labels, invalid state, messages, select triggers (pill), checkbox/switch.
- Overlays: dialogs (backup detail, terminal, logs download, input dialog), sheets (monitoring nodes), alert-dialogs (confirm), dropdown menus (row actions, column toggle), tooltips (node info, volume badges), popovers (access mode, multiselect), hover cards (log stream).
- Menus: keyboard arrows, typeahead, checkbox/radio items stay open; submenu (column header filter) opens right.
- Data: tables (`users`, `projects`, `apps`, `agent`), pagination (`pagignation`), tabs (`settings/server`, app tabs), empty states, progress bars with the `color` prop (`storages`, `app-volumes-monitoring`).
- `shadcn add <component>` in a scratch component confirms future installs use base-maia + lucide (already validated via `shadcn info`).

## Notes / follow-ups

- `item.tsx` was ported to the registry API; if the old bespoke API is still referenced anywhere, it is now a superset so only new parts changed.
- Horizontal scroll needs a visual check after the `Content` fix (verify the horizontal scrollbar appears and drags on the tabs rows and `app-action-buttons`).
- 2 pre-existing jsdom failures remain (`server-settings-tabs.unit.spec.ts`, from the earlier tabs migration); `git.service.unit.spec.ts` needs a container runtime (k3s/testcontainers) and fails in this environment. Neither is caused by this restyle.
- Verification for the second batch (`item`/`drawer`/`command`/`sonner`/`calendar`/`chart` + scroll-area fix): `tsc` 0 errors, `yarn lint` 0 errors (2 pre-existing warnings); full `yarn build` re-run pending.
