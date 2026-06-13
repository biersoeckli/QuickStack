# Frontend UI Patterns Reference

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

### Authorization in Server Components

Use helpers from `action-wrapper.utils.ts`:

| Helper | Purpose |
|--------|---------|
| `getAuthUserSession()` | Requires authenticated user, redirects to `/auth` if not |
| `getAdminUserSession()` | Requires admin role |
| `isAuthorizedReadForApp(appId)` | Checks read permissions for specific app |
| `isAuthorizedWriteForApp(appId)` | Checks write permissions for specific app |
| `isAuthorizedForBackups()` | Checks backup permissions |

## Forms: react-hook-form + Zod + Server Actions

Every form follows this pattern:

1. Define or import a Zod schema.
2. `useForm<T>({ resolver: zodResolver(schema) })`
3. Wrap in shadcn `<Form>` provider.
4. Use `<FormField>` with `control`, `name`, and `render`.
5. Submit through `Toast.fromAction()` or `Actions.run()`.

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

- `CheckboxFormField`
- `SelectFormField`
- `MultiSelectField`

## Server Action Consumption

Always use a wrapper — never `await` a Server Action directly from client code.

### `Toast.fromAction()`

Use when a user-triggered action needs loading, success, and error feedback.

```tsx
const returnValue = await Toast.fromAction(
    () => deleteProject(projectId),
    'Project deleted'
);
```

### `Actions.run()`

Use for background operations or when loading state is handled manually.

```tsx
const result = await Actions.run(() => getProjectDetails(projectId));
```

Map validation errors back to the form with:

```tsx
FormUtils.mapValidationErrorsToForm(serverActionResult, form);
```

## Zustand State Stores

All stores live in `src/frontend/states/zustand.states.ts`.

| Store | Purpose | Access Pattern |
|-------|---------|----------------|
| `useConfirmDialog` | Promise-based confirm dialogs | `const { openConfirmDialog } = useConfirmDialog();` |
| `useInputDialog` | Promise-based input dialogs | `const { openInputDialog } = useInputDialog();` |
| `useBreadcrumbs` | Page breadcrumb navigation | `<BreadcrumbSetter items={[...]} />` |
| `usePodsStatus` | Real-time pod status (SSE) | `usePodsStatus()` / `.subscribeToStatusChanges()` |

Outside React, access via `useStore.getState()`.

## Data Tables

Prefer `SimpleDataTable` for standard tables.

### Column Format

Columns are tuples: `[accessorKey, headerLabel, isVisible, renderFn?]`

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

### Common Options

- `tableIdentifier`
- `hideSearchBar`
- `showSelectCheckbox`
- `onItemClick`
- `onItemClickLink`
- `actionCol`
- `onRowSelectionUpdate`
- `columnFilters`

### Persistence

- `localStorage`: column visibility, sorting, page size
- `sessionStorage`: search filter, current page

## Dialogs

Use Zustand-backed global dialogs instead of one-off dialog state.

### `useDialog`

Prefer responsive sizing options:

```tsx
const { openDialog } = useDialog();

<Button
    type="button"
    onClick={() => openDialog(<ImportDialog />, {
        width: 'calc(100vw - 2rem)',
        maxWidth: '760px',
        maxHeight: '90vh',
    })}
>
    Import
</Button>
```

Inside dialog content, use `useDialogContext()` to close or resolve:

```tsx
function ImportDialog() {
    const { closeDialog } = useDialogContext();

    return (
        <>
            <DialogHeader>
                <DialogTitle>Import</DialogTitle>
                <DialogDescription>Optional description</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => closeDialog(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={() => closeDialog(true)}>
                        Import
                    </Button>
                </div>
            </div>
        </>
    );
}
```

Simple fixed-width dialogs can still use:

```tsx
openDialog(<PublicDeployKeyDialog publicKey={publicKey} />, '680px');
```

### Confirm/Input Dialogs

Use `useConfirmDialog` and `useInputDialog` only for simple prompts:

```tsx
const { openConfirmDialog } = useConfirmDialog();

const confirmed = await openConfirmDialog({
    title: 'Delete app?',
    description: 'This cannot be undone.',
    okButton: 'Delete',
});
```

For async button actions inside `AlertDialog`, use `LoadingAlertDialogAction`.

## Styling

- Prefer shadcn/ui components and extend in `src/components/custom/`
- Use Tailwind utility classes as the primary styling method
- Use `cn()` for conditional classes
- Use QuickStack brand tokens like `qs-base`, `qs-100` through `qs-700`
- Use theme variables like `primary`, `secondary`, `destructive`, and `sidebar-*`
- Support dark mode via the `class` strategy

```tsx
<div className={cn("p-4 rounded-lg", isActive && "border-primary")} />
```

## Real-Time UI

### Terminal Streaming

Use Socket.IO via `src/frontend/sockets/sockets.ts`:

```tsx
import { podTerminalSocket } from "@/frontend/sockets/sockets";

podTerminalSocket.emit('openTerminal', termInfo);
podTerminalSocket.on(outputKey, (data) => terminal.write(data));
```

### Log Streaming & Pod Status

Use SSE via `fetch` + `ReadableStream`:

```tsx
const response = await fetch('/api/pod-logs', {
    method: 'POST',
    body: JSON.stringify({ namespace, podName }),
    signal: controller.signal,
});
const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
```

Always use `AbortController` for cleanup in `useEffect`.

## Common Components Reference

| Component | Location | Use For |
|-----------|----------|---------|
| `PageTitle` | `custom/page-title.tsx` | Consistent page headers |
| `SubmitButton` | `custom/submit-button.tsx` | Form submit with pending state |
| `CopyInputField` | `custom/copy-input-field.tsx` | Read-only input with copy button |
| `BreadcrumbSetter` | `breadcrumbs-setter.tsx` | Set page breadcrumbs from server pages |
| `PodsStatusPollingProvider` | `custom/pods-status-polling-provider.tsx` | SSE polling init |
| `MultiStateProgress` | `custom/multi-state-progress.tsx` | Multi-color progress bars |
