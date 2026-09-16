# select

2026-09-16, engine (legacy `new-york`, no base counterpart), migrated Select (`radix-ui`) to Base UI Select.

## Changed

- `src/components/ui/select.tsx`: `Select` -> bare `SelectPrimitive.Root` re-export; `Content` -> `Portal > Positioner > Popup` with `alignItemWithTrigger` (default `true`) replacing the radix `position` prop (`sideOffset` default 4, `side` bottom, `align` center); `Viewport` -> `List` (keeps `p-1`), `ScrollUpButton`/`ScrollDownButton` -> `ScrollUpArrow`/`ScrollDownArrow` (`top-0`/`bottom-0 w-full`); `Label` -> `GroupLabel`; `Icon`/`ItemIndicator` use `render`; item anatomy is now `ItemText` first then an absolutely-positioned `ItemIndicator`. Class mapping `max-h-(--radix-select-content-available-height)` -> `max-h-(--available-height)`, `origin-(--radix-select-content-transform-origin)` -> `origin-(--transform-origin)`, trigger `data-[placeholder]` -> `data-placeholder`, `data-[state=open|closed]` -> `data-open|data-closed`; dropped the radix `position="popper"` translate classes and added `data-[align-trigger=true]:animate-none`.
- Consumer sweep (`onValueChange` signature widens to `(value: Value | null, eventDetails)`; null is normalised to `''` because these selects always have a value):
  `src/app/project/[projectId]/agent-components/create-agent-dialog.tsx:136`, `src/app/project/agent/[agentId]/general/agent-model-configuration-card.tsx:107`, `src/app/project/app/[appId]/advanced/app-network-policy-rule-dialog.tsx:99`, `src/app/settings/llm-gateways/llm-gateway-edit-overlay.tsx:231`, `src/app/settings/users/users-table-bulk-role-assignment.tsx:62`.
  Other consumers (`node-port-edit-dialog`, `logs`, `health-check-settings`, `create-template-agent-setup-dialog`, `sso-provider-edit-overlay`, `qs-build-settings`, `pagignation`, `select-form-field`, `edit-project-dialog`) needed no edit: the wrapper names and `value`/`defaultValue`/`disabled` props are compatible.
- `src/components/ui/pagignation.tsx` rewritten for the shared Select and its radix icons replaced with lucide (`ChevronsLeft`/`ChevronLeft`/`ChevronRight`/`ChevronsRight`).
- Leftover scan: no `radix-ui`/`@radix-ui` matches in the files above.

## Left alone

- No consumer ever passed `position="popper"`, so the `alignItemWithTrigger` default (item-aligned, the radix default) preserves placement.
- `SelectLabel`/`SelectGroup` have no consumers; they map to `GroupLabel`/`Group` and require the label to be inside a group if ever used.

## Behavior changes

- `onValueChange` now receives `Value | null` plus an `eventDetails` argument; the five handlers that fed `useState<string>` were wrapped with `value ?? ''`.
- `Select.Value` resolves the selected item's label (Base UI 1.8) so placeholder/labels behave as before.
- `modal` defaults to `true`, scroll-locking like radix did.

## Verify by hand

- Open the gateway/project selects in the agent and LLM-gateway dialogs: the chosen item shows in the trigger, not a raw id.
- `node-port-edit-dialog` protocol select and `health-check-settings` scheme select: choose an option, then cancel and reopen — the current value is highlighted with a check.
- Pagination page-size select (`pagignation`): changing the page size updates the table.
- Keyboard: focus the trigger, ArrowDown/Enter lists items, Escape closes and Typeahead jumps to a matching item.
