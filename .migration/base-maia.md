# base-maia restyle

2026-09-16, whole-project, strategy: shadcn CLI golden-pair (preset `maia`, base UI, icons resolved to `lucide`), plus replay of local QuickStack customizations. Verdict: all in-scope wrappers restyled; build + tests green.

## Changed

- `components.json`: `style` `new-york` -> `base-maia`; added `iconLibrary: "lucide"`, `menuColor: "default"`, `menuAccent: "subtle"`, `rtl: false`; aliases/utils kept (`@/frontend/utils/utils`). `shadcn info` now reports `base: base`, `style: maia`.
- `src/app/globals.css`: added `@import "shadcn/tailwind.css"` (defines the `data-open/closed/checked/...` custom variants the Maia classes rely on) and `--font-heading: var(--font-sans)` in `@theme inline`. The neutral tokens and the extended radius scale (`--radius-sm..4xl`) were already present from the Tailwind v4 upgrade.
- Regenerated from base-maia via `shadcn add <component> --overwrite` (one registry golden each, icons/aliases resolved by the CLI):
  `button`, `label`, `input`, `textarea`, `separator`, `card`, `skeleton`, `spinner`, `avatar`, `checkbox`, `switch`, `table`, `tabs`, `collapsible`, `empty`, `scroll-area`, `breadcrumb`, `alert`, `dialog`, `alert-dialog`, `sheet`, `dropdown-menu`, `select`, `tooltip`, `popover`, `hover-card`, `sidebar`, `form`.
- Replayed local customizations:
  - `progress.tsx`: restored the `color` prop (`blue | green | red | orange | default`) onto the Maia multi-part Progress; it now feeds `ProgressIndicator`.
  - `sidebar.tsx`: `useIsMobile` import repointed to `@/frontend/hooks/use-mobile`.
  - Removed the stray `src/hooks/use-mobile.ts` the CLI created.
- Leftover scan: no `radix-ui`/`@radix-ui` in `src`; no `--radix-*` in `src/components/ui`.

## Left alone

- Local custom components (not registry items, API preserved per inventory): `item.tsx` (`size: "xs"`, custom `ItemMedia`/`ItemContent`/... API), `column-header.tsx`, `column-toggle.tsx`, `pagignation.tsx`, `loading-spinner.tsx`, `full-loading-spinnter.tsx`. They consume the restyled primitives and typecheck unchanged; their own class strings are intentionally not restyled.
- Third-party wrappers (out of scope): `drawer.tsx` (vaul), `command.tsx` (cmdk), `sonner.tsx`, `calendar.tsx` (react-day-picker), `chart.tsx` (recharts).
- `shadcn/tailwind.css` is imported from the installed `shadcn` devDependency; no new runtime dependency was added.

## Behavior / visual changes

- Maia look: buttons/selects/inputs are pill-shaped (`rounded-4xl`), menus/dialogs use larger radii (`rounded-2xl`/`rounded-4xl`), softer `ring-foreground/5`, and the `destructive` button variant is now a soft red tint instead of solid red.
- `button.tsx` no longer emits `data-variant`/`data-size` (base-maia dropped them); no consumer relied on them.
- New theme token `--font-heading`; base-maia headings (e.g. DialogTitle) use it.
- Progress markup is the Maia multi-part shape (Root > Track > Indicator, `h-3`/`bg-muted`); the `color` prop is preserved but bar height/muted track changed from the new-york look.
- Menu/dialog open-close animations now resolve through `shadcn/tailwind.css` custom variants, so `data-open:`/`data-closed:` classes actually generate (previously the bare `data-open:` variant had no definition).
- Known registry quirk left as-is: `tooltip.tsx` carries a dead `data-[state=delayed-open]` variant from the golden; harmless.

## Verify by hand

- Global: run `yarn dev`; check Light + Dark. Sidebar collapsed/expanded/mobile (mobile uses the Sheet), nav-bar user menu.
- Buttons: primary/outline/secondary/ghost/destructive/link + `xs/sm/lg/icon` sizes on `projects-table`, dialogs, `settings`.
- Forms: `settings/server` build settings, login/register, project app general — labels, invalid state, messages, select triggers (pill), checkbox/switch.
- Overlays: dialogs (backup detail, terminal, logs download, input dialog), sheets (monitoring nodes), alert-dialogs (confirm), dropdown menus (row actions, column toggle), tooltips (node info, volume badges), popovers (access mode, multiselect), hover cards (log stream).
- Menus: keyboard arrows, typeahead, checkbox/radio items stay open; submenu (column header filter) opens right.
- Data: tables (`users`, `projects`, `apps`, `agent`), pagination (`pagignation`), tabs (`settings/server`, app tabs), empty states, progress bars with the `color` prop (`storages`, `app-volumes-monitoring`).
- `shadcn add <component>` in a scratch component confirms future installs use base-maia + lucide (already validated via `shadcn info`).

## Notes / follow-ups

- `item.tsx` was deliberately not restyled (custom API). If the Maia item look is wanted, port the visual classes onto the existing API rather than switching to the registry item.
- 2 pre-existing jsdom failures remain (`server-settings-tabs.unit.spec.ts`, from the earlier tabs migration); `git.service.unit.spec.ts` needs a container runtime (k3s/testcontainers) and fails in this environment. Neither is caused by this restyle.
