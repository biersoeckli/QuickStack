# sidebar

2026-09-16, engine (legacy `new-york`, no base counterpart), removed the last radix `Slot` uses and rewired the composed Tooltip/Sheet consumers.

## Changed

- `src/components/ui/sidebar.tsx`: replaced the `Slot`/`asChild` idiom with `useRender` + `mergeProps` on `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuSubButton` (`render` prop, `data-slot`/`data-sidebar`/`data-size`/`data-active` preserved). `TooltipProvider delayDuration={0}` -> `delay={0}`; `SidebarMenuButton` builds its element with `useRender` and passes it to `<TooltipTrigger render={button} />`. Menu-button variants and menu-action `data-[state=open]` hooks -> `data-popup-open`.
- Consumer `src/app/sidebar-client.tsx`: `SidebarMenuButton asChild` -> `render={<Link .../>}` (8 sites), `DropdownMenuTrigger`/`DropdownMenuItem` `asChild` -> `render`, `data-[state=open]:bg-sidebar-accent ...` -> `data-popup-open:...`, `w-(--radix-popper-anchor-width)` -> `w-(--anchor-width)`.
- `src/app/sidebar-logout-button.tsx` needed no edit (no `asChild`). `src/components/custom/breadcrumbs-generator.tsx` imports `SidebarTrigger` unchanged.
- Leftover scan: no `radix-ui`/`@radix-ui` matches in `sidebar.tsx`, `sidebar-client.tsx`, `sidebar-logout-button.tsx`, `breadcrumbs-generator.tsx`.

## Left alone

- `src/components/ui/drawer.tsx` (vaul) untouched; `src/components/custom/breadcrumbs-generator.tsx` only changed for the breadcrumb dropdown, not the sidebar trigger.
- `cmdk`/`vaul`/`sonner`/`recharts` untouched.

## Behavior changes

- `SidebarMenuButton`/`SidebarMenuAction`/`SidebarMenuSubButton`/`SidebarGroupLabel`/`SidebarGroupAction` now take `render` instead of `asChild`; all project call sites were converted.
- Mobile sidebar uses the Base UI-backed `Sheet` (see `sheet.md`).
- Tooltip open delay defaults to the sidebar provider's `delay={0}` (unchanged feel).

## Verify by hand

- Collapse/expand the sidebar; menu buttons keep active/hover styling and the icon-collapse layout.
- In collapsed mode hover a menu item: the right-side tooltip opens; clicking the item still navigates (it renders a `render`ed `<Link>`).
- Open a project's workload submenu from the chevron action; the menu stays anchored to the action button.
- Open the user menu at the bottom: `data-popup-open` styling applies to the trigger while open.
