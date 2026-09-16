# progress

2026-09-16, engine (legacy `new-york` style, no base counterpart; in-place because the public interface is unchanged), Progress now wraps `@base-ui/react/progress`, inserts the required `Track`, and lets the primitive drive the fill width instead of the old `translateX` style.

## Changed

- `src/components/ui/progress.tsx`: import switched from `{ Progress as ProgressPrimitive } from "radix-ui"` to `@base-ui/react/progress`; prop type moved to `ProgressPrimitive.Root.Props`. Added `<ProgressPrimitive.Track className="h-full w-full">` around the indicator and deleted the manual `style={{ transform: translateX(-(100 - value)%) }}`; `value` is now forwarded explicitly to Root (required prop). The local `color` prop, `colorClasses`, `data-slot`, and all classes are unchanged.
- Leftover scan clean: `grep -n "radix-ui\|@radix-ui\|IconPlaceholder" src/components/ui/progress.tsx` returned no matches.
- No consumer call sites needed edits: `app-volumes-monitoring.tsx:90`, `monitoring-nodes.tsx:257/266/283`, `storages.tsx:173` pass only `value` / `className` / `color`.

## Left alone

- `src/components/custom/multi-state-progress.tsx` looks related but is a hand-rolled segmented bar built from plain `<div>`s (no Radix import); intentionally untouched.
- cmdk (command), vaul (drawer), sonner, input-otp, react-day-picker (calendar), recharts (chart) wrappers are not Radix and were not touched.

## Behavior changes

- The fill is now animated by Base UI setting the indicator `width` inline, where Radix used a `transform: translateX(...)` style. Same end state, but the transition animates layout width instead of a compositor transform. Flagged, not patched; drop `transition-all` to `transition-[width]` only if jank is observed.
- Radix `data-state="loading" | "complete" | "indeterminate"` hooks become Base UI presence attributes (`data-progressing` / `data-complete` / `data-indeterminate`). No app code styles against these, so nothing breaks.

## Verify by hand

- Open monitoring; CPU/RAM bars should fill to the same percentages and keep the blue default color.
- Open a storage volume with the red (≥90) or orange (≥80) threshold color; confirm the fill color and rounded track are unchanged.
- Change a percentage and confirm the bar animates smoothly; check no horizontal overflow is introduced by the new Track wrapper.
