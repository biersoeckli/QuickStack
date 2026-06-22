---
name: frontend-ui-patterns
description: Create and update QuickStack frontend pages, React components, forms, dialogs, tables, streaming UI, and Zustand-backed state using the project's established UI conventions. Use when editing frontend files, shadcn/ui composition, react-hook-form + Zod flows, Server Action consumption from client components, or client/server component boundaries.
---

# Frontend UI Patterns

## Quick Start

For QuickStack frontend work:

- Use kebab-case filenames.
- Put shadcn/ui primitives in `src/components/ui/`.
- Put composed UI in `src/components/custom/`.
- Put frontend hooks, helpers, sockets, and Zustand usage in `src/frontend/`.
- Co-locate page-specific Server Actions in `actions.ts` beside the consuming page.

## Core Workflow

When creating or updating frontend UI:

- Decide the boundary first: server pages fetch data and check auth; client components handle interaction.
- Build forms with `react-hook-form`, Zod, shadcn `Form`, and shared field wrappers.
- Consume Server Actions through `Toast.fromAction()` or `Actions.run()`, not direct awaits.
- Prefer Zustand-backed shared dialogs and stores over one-off local global state.
- Use `SimpleDataTable` for standard tables before building custom table behavior.
- Style with shadcn/ui plus Tailwind utilities and `cn()`.

## Boundary Rules

- Use `'use server'` for pages and layouts that fetch data or gate authorization.
- Use `'use client'` for dialogs, forms, tables, event handlers, and streaming UI.
- Use auth helpers from `action-wrapper.utils.ts` in server components.

## Forms And Actions

- Add route-safe validation with shared or local Zod schemas.
- Map server validation errors back with `FormUtils.mapValidationErrorsToForm(...)`.
- Use `SubmitButton` for form submits when possible.

## State, Dialogs, And Streaming

- Reuse stores in `src/frontend/states/zustand.states.ts` before adding new ones.
- Use `useDialog`, `useConfirmDialog`, and `useInputDialog` for modal flows.
- Clean up SSE and socket work with `AbortController` or equivalent effect cleanup.

## Reference

See `REFERENCE.md` for concrete examples covering server/client boundaries, auth helpers, forms, Server Actions, Zustand stores, `SimpleDataTable`, dialogs, styling, and real-time UI.
