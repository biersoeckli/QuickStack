---
description: "Use when creating, editing, or reviewing QuickStack frontend pages, React components, forms, dialogs, data tables, real-time streaming UI, or Zustand state. Covers shadcn/ui composition, react-hook-form + Zod patterns, Server Action consumption, and client/server component boundaries."
---

# QuickStack Frontend & UI Conventions

## File Naming & Location

- kebab-case filenames: `edit-project-dialog.tsx`, `pod-status-indicator.tsx`
- shadcn/ui primitives: `src/components/ui/`
- Custom composed components: `src/components/custom/`
- Frontend utils/hooks/state: `src/frontend/`
- Server Actions: co-located `actions.ts` next to the page that uses them

## Client vs Server Boundaries

Pages and layouts use `'use server'` — fetch data, check auth, pass props down:

```tsx
// src/app/backups/page.tsx
'use server'

export default async function BackupsPage() {
    await isAuthorizedForBackups();
    const data = await backupService.getBackupsForAllS3Targets();
    return <BackupsTable data={data.backupInfoModels} />;
}
```

Interactive components (forms, tables, dialogs, event handlers) use `'use client'`:

```tsx
'use client'

export default function EditProjectDialog({ children }: { children: React.ReactNode }) {
    // ...
}
```

### Authorization in Servercomponents

Use Helpers from `action-wrapper.utils.ts`:

| Helper | Purpose |
|--------|---------|
| `getAuthUserSession()` | Requires authenticated user, redirects to `/auth` if not |
| `getAdminUserSession()` | Requires admin role |
| `isAuthorizedReadForApp(appId)` | Checks read permissions for specific app |
| `isAuthorizedWriteForApp(appId)` | Checks write permissions for specific app |
| `isAuthorizedForBackups()` | Checks backup permissions |

## Forms: react-hook-form + Zod + Server Actions

Every form follows this pattern:

1. Define or import a Zod schema (generated schemas in `src/shared/model/generated-zod/`)
2. `useForm<T>({ resolver: zodResolver(schema) })`
3. Wrap in shadcn `<Form>` provider
4. Use `<FormField>` with `control`, `name`, `render`
5. Submit calls a Server Action via `Toast.fromAction()` or `Actions.run()`

```tsx
'use client'

const form = useForm<CreateAppSchema>({
    resolver: zodResolver(createAppSchema),
});

const onSubmit = async (data: CreateAppSchema) => {
    await Toast.fromAction(
        () => createApp(data.appName, projectId),
        'App created'
    );
};

return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
                control={form.control}
                name="appName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <SubmitButton>Create</SubmitButton>
        </form>
    </Form>
);
```

Use existing custom form field wrappers when applicable:
- `CheckboxFormField` — checkbox with form binding
- `SelectFormField` — select dropdown with validation
- `MultiSelectField` — multi-select via Popover/Command

## Server Action Consumption

**Always use a wrapper** — never `await` a Server Action directly from client code. Two utilities exist:

**`Toast.fromAction()`** — shows loading/success/error toasts automatically, returns ServerActionResult:
Use this when a user-triggered action needs feedback and a toast is appropriate.

```tsx
const returnValue = await Toast.fromAction(
    () => deleteProject(projectId),
    'Project deleted'
);
// returnValue is ServerActionResult<TValidationData, TReturnData>
// Accessing data: returnValue.data (contains the value if successful)
// On error: Promise rejects, error toast shown automatically.
```

**`Actions.run()`** — runs action (without loading indicatoer), shows error toast on failure, returns data:
Use this for background operations or when you want to handle loading state manually.

```tsx
const result = await Actions.run(() => getProjectDetails(projectId));
// result is the value of the property data in the ServerActionResult returned by the Server Action
```

Map validation errors back to form fields with:

```tsx
FormUtils.mapValidationErrorsToForm(serverActionResult, form);
```

## Zustand State Stores

All stores live in `src/frontend/states/zustand.states.ts`. In React components, use the hook directly. Outside React, access the store via `useStore.getState()`.

| Store | Purpose | Access Pattern |
|-------|---------|----------------|
| `useConfirmDialog` | Promise-based confirm dialogs | `const { openConfirmDialog } = useConfirmDialog();` then `await openConfirmDialog({...})` |
| `useInputDialog` | Promise-based input dialogs | `const { openInputDialog } = useInputDialog();` then `await openInputDialog({...})` |
| `useBreadcrumbs` | Page breadcrumb navigation | `<BreadcrumbSetter items={[...]} />` from page |
| `usePodsStatus` | Real-time pod status (SSE) | `usePodsStatus()` in components, `.subscribeToStatusChanges()` for reactive |

Never create new Zustand stores without checking if existing stores cover the need.

## Data Tables

**`SimpleDataTable`** — quick inline tables with column tuples and built-in persistence, filtering, selection.
Covers 90% of table use cases. Automatically persists column visibility, sorting, and pagination to localStorage; session filters to sessionStorage.

### Column Format
Columns are tuples: `[accessorKey, headerLabel, isVisible, renderFn?]`
- `accessorKey` — property name from data item (string)
- `headerLabel` — display header text (string)
- `isVisible` — show by default (boolean)
- `renderFn` — optional custom render function `(item: TData) => ReactNode`

### Basic Example
```tsx
<SimpleDataTable
    columns={[
        ['id', 'ID', true],
        ['name', 'Name', true, (item) => <span className="font-medium">{item.name}</span>],
        ['email', 'Email', true],
    ]}
    data={items}
/>
```

### Full Example with All Options
```tsx
const [selectedItems, setSelectedItems] = useState<Item[]>([]);

<SimpleDataTable
    tableIdentifier="items-table"
    columns={[
        ['id', 'ID', false],
        ['name', 'Name', true, (item) => <strong>{item.name}</strong>],
        ['status', 'Status', true, (item) => <StatusBadge status={item.status} />],
        ['createdAt', 'Created', true, (item) => formatDateTime(item.createdAt)],
    ]}
    data={items}
    hideSearchBar={false}
    showSelectCheckbox={true}
    onRowSelectionUpdate={(selected) => setSelectedItems(selected)}
    onItemClick={(item) => console.log('Clicked:', item)}
    onItemClickLink={(item) => `/items/${item.id}`}
    actionCol={(item) => (
        <div className="flex gap-2">
            <Button onClick={() => handleEdit(item)}>Edit</Button>
            <Button variant="destructive" onClick={() => handleDelete(item.id)}>Delete</Button>
        </div>
    )}
    columnFilters={[
        {
            accessorKey: 'status',
            filterLabel: 'Active',
            filterFunction: (item) => item.status === 'ACTIVE'
        },
        {
            accessorKey: 'status',
            filterLabel: 'Inactive',
            filterFunction: (item) => item.status === 'INACTIVE'
        },
    ]}
/>
```

### Props Reference

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `tableIdentifier` | `string?` | `pathname` | Unique key for localStorage/sessionStorage persistence |
| `columns` | `[key, label, visible, render?][]` | required | Column definitions |
| `data` | `TData[]` | required | Array of items to display |
| `hideSearchBar` | `boolean` | `false` | Hide the global search/filter bar |
| `showSelectCheckbox` | `boolean` | `false` | Show row selection checkboxes |
| `onItemClick` | `(item) => void` | — | Callback when row clicked (first visible column) |
| `onItemClickLink` | `(item) => string` | — | Return URL to navigate on row click |
| `actionCol` | `(item) => ReactNode` | — | Render function for rightmost action column |
| `onRowSelectionUpdate` | `(selected) => void` | — | Callback when row selection changes |
| `columnFilters` | `{accessorKey, filterLabel, filterFunction}[]` | — | Column-specific filter options in dropdown |

### State Persistence

- **localStorage**: Column visibility, sorting order, page size — persists across sessions
- **sessionStorage**: Global search filter, current page — cleared when tab closes
- **tableIdentifier**: Scopes persistence key (defaults to current pathname)

## Dialogs

Use Zustand-backed global dialogs for confirms and inputs — don't create one-off dialog state:

```tsx
const { openConfirmDialog } = useConfirmDialog();

const confirmed = await openConfirmDialog({
    title: 'Delete app?',
    description: 'This cannot be undone.',
    okButton: 'Delete',
});
if (confirmed) { /* proceed */ }
```

If you need to trigger a dialog outside a React component, use `useConfirmDialog.getState()` or `useInputDialog.getState()`.

For async button actions inside AlertDialog, use `<LoadingAlertDialogAction>`.

## Styling

- Use where possible, prefer shadcn/ui components and extend with custom components in `src/components/custom/`
- Tailwind utility classes as primary styling method
- `cn()` helper (clsx + tailwind-merge) for conditional classes:

```tsx
<div className={cn("p-4 rounded-lg", isActive && "border-primary")} />
```

- QuickStack brand colors via `qs-*` tokens (`qs-base`, `qs-100` through `qs-700`)
- Theme colors via CSS variables: `primary`, `secondary`, `destructive`, `sidebar-*`
- Dark mode supported via `class` strategy

## Real-Time UI

**Terminal streaming** — Socket.IO via shared manager in `src/frontend/sockets/sockets.ts`:

```tsx
import { podTerminalSocket } from "@/frontend/sockets/sockets";
podTerminalSocket.emit('openTerminal', termInfo);
podTerminalSocket.on(outputKey, (data) => terminal.write(data));
```

**Log streaming & pod status** — SSE via fetch + ReadableStream:

```tsx
const response = await fetch('/api/pod-logs', {
    method: 'POST',
    body: JSON.stringify({ namespace, podName }),
    signal: controller.signal,
});
const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
```

Always use `AbortController` for cleanup in `useEffect` return.

## Common Components Reference

| Component | Location | Use For |
|-----------|----------|---------|
| `PageTitle` | `custom/page-title.tsx` | Consistent page headers |
| `SubmitButton` | `custom/submit-button.tsx` | Form submit with `useFormStatus()` pending state |
| `CopyInputField` | `custom/copy-input-field.tsx` | Read-only input with copy button |
| `BreadcrumbSetter` | `breadcrumbs-setter.tsx` | Set page breadcrumbs from server pages |
| `PodsStatusPollingProvider` | `custom/pods-status-polling-provider.tsx` | SSE polling init (mounted in root layout) |
| `MultiStateProgress` | `custom/multi-state-progress.tsx` | Multi-color progress bars |
