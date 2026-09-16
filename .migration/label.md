# label

2026-09-16, engine, replaced the Radix Label primitive with a native label element while retaining wrapper styling and props.

## Changed

- src/components/ui/label.tsx:4 and :9 removed the Radix Label import and primitive, rendering native `<label>` with `React.ComponentProps<"label">` instead.
- Leftover scan clean: `grep -n "radix-ui\\|@radix-ui" src/components/ui/label.tsx` returned no matches.

## Left alone

- All Label consumers were left alone because the wrapper's public props and import path are unchanged.
- cmdk, vaul, sonner, input-otp, react-day-picker, and recharts wrappers were not touched because they are not Radix migration targets.

## Behavior changes


## Verify by hand

- Open a form that uses a Label and click its text; the associated input should receive focus.
- Tab through a disabled field group; the label should retain its disabled styling and the input should not accept interaction.
