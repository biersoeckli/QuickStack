# dropdown-menu

2026-09-16, engine (legacy `new-york`, no base counterpart), migrated DropdownMenu (`radix-ui`) to Base UI `Menu`.

## Changed

- `src/components/ui/dropdown-menu.tsx`: `DropdownMenu` -> `@base-ui/react/menu`; `Content` -> `Portal > Positioner > Popup` (`align` left at Base UI default `center` so the legacy centred placement is preserved, `sideOffset` default 4); part renames `Label` -> `GroupLabel`, `ItemIndicator` -> `CheckboxItemIndicator`/`RadioItemIndicator`, `Sub` -> `SubmenuRoot`, `SubTrigger` -> `SubmenuTrigger`; `SubContent` composes `DropdownMenuContent` with `align="start" alignOffset={-3} side="right" sideOffset={0}` (wrapper-shapes defaults); class mapping `max-h-(--radix-dropdown-menu-content-available-height)` -> `max-h-(--available-height)`, `origin-(--radix-dropdown-menu-content-transform-origin)` -> `origin-(--transform-origin)`, `data-[state=open|closed]` -> `data-open|data-closed`, submenu trigger open marker `data-[state=open]` -> `data-popup-open`; Positioner gets `isolate z-50 outline-none`.
- Consumer sweep (`asChild` -> `render`; item `onSelect` -> `onClick`; open-state class hooks -> `data-popup-open`; `--radix-popper-anchor-width` -> `--anchor-width`):
  `src/app/nav-bar.tsx`, `src/app/sidebar-client.tsx`, `src/app/projects/projects-table.tsx`, `src/app/project/[projectId]/agent-components/agent-table.tsx`, `src/app/project/[projectId]/app-components/apps-table.tsx`, `src/app/project/[projectId]/create-project-actions.tsx`, `src/app/project/agent/[agentId]/sandboxes/agent-sandboxes-card.tsx`, `src/app/project/[projectId]/app-components/project-network-graph/node-details-drawer.tsx` (`onSelect` -> `onClick` at :118/:130/:142/:151), `src/app/project/app/[appId]/overview/deployments-default-view.tsx` (:85), `src/app/project/app/[appId]/overview/deployments-grid-view.tsx` (:79/:85), `src/app/settings/users/users-table.tsx`, `src/app/settings/llm-gateways/llm-gateway-edit-overlay.tsx`, `src/app/settings/server/cluster-addon-update-info.tsx`, `src/components/custom/multiselect-dropdorw-field.tsx`, `src/components/custom/breadcrumbs-generator.tsx`, `src/components/custom/storage-class-combobox.tsx`, `src/components/ui/column-header.tsx`, `src/components/ui/column-toggle.tsx`.
- `Menu.GroupLabel` throws outside a `Group`/`RadioGroup`, so every `DropdownMenuLabel` call site was wrapped in `DropdownMenuGroup`: `projects-table.tsx:107`, `agent-table.tsx:97`, `apps-table.tsx:61`, `column-header.tsx:106`, `column-toggle.tsx:26`, `multiselect-dropdorw-field.tsx:67`.
- `src/app/nav-bar.tsx:29`: removed stale radix runtime attributes copied into the JSX (`id="radix-:reh:"`, `aria-haspopup`, `aria-expanded`, `data-state="closed"`, `control-id`); Base UI now owns trigger ARIA.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in the files above.

## Left alone

- `cmdk` `CommandItem` `onSelect` handlers (`git-branch-step.tsx`, `build-method-step.tsx`, `storage-edit-overlay.tsx`, `storage-class-combobox.tsx`, `multiselect-field.tsx`) and custom-component `onSelect` props (`GitBranchStep`, `FrameworkStep`): not radix menu items.
- `src/app/sidebar-logout-button.tsx`: consumer with no `asChild`, needed no edit.

## Behavior changes

- `DropdownMenuCheckboxItem` / `DropdownMenuRadioItem` no longer close the menu on click (`closeOnClick` defaults to `false` in Base UI; radix closed by default). This is the desired multi-select behaviour in `column-toggle` and `multiselect-dropdorw-field`, but it is a delta — add `closeOnClick` if single-choice closing is wanted.
- Item selection now runs through `onClick` instead of radix `onSelect`; checked/radio items keep `onCheckedChange` with an extra `eventDetails` argument.
- `loop` moves to `DropdownMenu` root as `loopFocus` (not used here).

## Verify by hand

- Row action menus (`projects-table`, `apps-table`, `agent-table`, `users-table`) open from the kebab button, keyboard navigate with arrows, and activate with Enter.
- `node-details-drawer` Deploy/Rebuild/Start/Stop actions still fire once (they moved from `onSelect` to `onClick`).
- The "Actions"/"Filter Options"/"Kantone" labels render and each menu still opens without a console error about a missing group context.
- `dropdown-menu` submenus: open the `column-header` filter menu and a submenu opens to the right with slight overlap.
- Checkbox menus (`column-toggle`, `multiselect-dropdorw-field`) stay open while toggling several entries.
