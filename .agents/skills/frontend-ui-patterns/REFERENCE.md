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

Use Zustand-backed global dialogs instead of one-off dialog state. Keep trigger and dialog content in separate components (often separate files for reuse).

### Pattern: Trigger + Dialog Content

**Trigger component** — opens dialog via `useDialog().openDialog()`:

```tsx
'use client'

import { useDialog } from "@/frontend/states/zustand.states";

export default function MyTrigger({ children, someProp }: { children: React.ReactNode; someProp: string }) {
    const { openDialog } = useDialog();

    const handleOpen = () => {
        openDialog(<MyDialogContent someProp={someProp} />, { maxWidth: '520px' });
    };

    return (
        <div onClick={handleOpen}>
            {children}
        </div>
    );
}
```

**Dialog content — variant A: with form** (react-hook-form + Server Action):

```tsx
'use client'

import { useDialogContext } from "@/frontend/states/dialog-context";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

function MyFormDialog({ someProp }: { someProp: string }) {
    const { closeDialog } = useDialogContext();

    const form = useForm<MySchema>({
        resolver: zodResolver(mySchema),
        defaultValues: { name: someProp ?? '' },
    });

    const [state, formAction] = useFormState(
        (prev, payload) => myServerAction(prev, payload),
        FormUtils.getInitialFormState()
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success(state.message ?? 'Saved.');
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <form
                className="flex max-h-[80vh] flex-col overflow-hidden"
                action={() => form.handleSubmit((data) => formAction(data))()}
            >
                <DialogHeader>
                    <DialogTitle>My Dialog</DialogTitle>
                </DialogHeader>
                <ScrollArea className="mt-4 flex-1 min-h-0">
                    <div className="space-y-4 px-2">
                        {/* form fields */}
                    </div>
                </ScrollArea>
                <DialogFooter className="mt-4">
                    <SubmitButton>Save</SubmitButton>
                    <Button type="button" variant="outline" onClick={() => closeDialog()}>
                        Cancel
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}
```

The success (primary) button is always the first button in the footer, cancel is always the last.

**Dialog content — variant B: without form** (simple confirm/info dialog):

```tsx
'use client'

import { useDialogContext } from "@/frontend/states/dialog-context";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

function MyConfirmDialog({ itemName }: { itemName: string }) {
    const { closeDialog } = useDialogContext();

    return (
        <>
            <DialogHeader>
                <DialogTitle>Delete {itemName}?</DialogTitle>
                <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>
           {/* Here additional content of the dialog can be added. If allot of content -> use ScrollArea */}
            <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => closeDialog(false)}>
                    Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={() => closeDialog(true)}>
                    Delete
                </Button>
            </DialogFooter>
        </>
    );
}
```

Await result from trigger:

```tsx
const confirmed = await openDialog(<MyConfirmDialog itemName="foo" />);
if (confirmed) { /* delete */ }
```

### `useDialog` Sizing

Second arg: `DialogSizeProps` object or shorthand string (= `maxWidth`):

```tsx
// Full size control
openDialog(<Content />, {
    width: 'calc(100vw - 2rem)',
    maxWidth: '760px',
    maxHeight: '90vh',
});

// Shorthand: string = maxWidth
openDialog(<Content />, '680px');
```

### `useDialogContext`

Inside dialog content, close with optional result:

```tsx
const { closeDialog } = useDialogContext();

closeDialog();        // close, no result
closeDialog(someData); // close, pass result to openDialog() awaiter
```
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
