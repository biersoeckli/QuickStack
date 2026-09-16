# hover-card

2026-09-16, engine (legacy `new-york`, no base counterpart), migrated HoverCard to Base UI Preview Card.

## Changed

- `src/components/ui/hover-card.tsx`: primitive renamed `HoverCard` -> `PreviewCard` from `@base-ui/react/preview-card`; public wrapper names stay `HoverCard*`. Content split into `Portal > Positioner > Popup`; `sideOffset` default kept at 4, `side` default `bottom`, `align` default `center`; class mapping `origin-(--radix-hover-card-content-transform-origin)` -> `origin-(--transform-origin)`, `data-[state=open|closed]` -> `data-open|data-closed`.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in `hover-card.tsx`.

## Left alone

- `src/components/custom/build-logs-streamed.tsx` and `src/components/custom/logs-streamed.tsx`: genuine consumers, but they pass no `asChild` or delay props, so the source-compatible wrapper rewrite needed no edits.

## Behavior changes

- Open/close delays moved from `HoverCard.Root` to `HoverCardTrigger` (`delay` default 600, `closeDelay` default 300); neither consumer set them, so no visible change.
- `disableHoverableContent` is dropped (none used).

## Verify by hand

- Hover the build/log entries that show a hover card: the card appears next to the trigger and closes after the pointer leaves.
- Focus the trigger with the keyboard: the card opens and Escape closes it.
