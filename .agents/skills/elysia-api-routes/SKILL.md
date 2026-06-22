---
name: elysia-api-routes
description: Create and update QuickStack Elysia REST API routes using the project's established /api/v1 route conventions. Use when adding or editing files under src/server/api/v1, defining Elysia query/params/body/response schemas, or handling REST API authorization and errors.
---

# Elysia API Routes

## Quick Start

For QuickStack REST routes under `src/server/api/v1`, follow the current examples in `app/route.ts` and `project/route.ts`:

```ts
export const resourceRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/resources/:id', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const resource = await resourceService.getByIdOrUndefined(params.id);
        if (!resource) throw new ApiNotFoundException();

        ensureReadResource(identity, resource.id);

        return resource;
    }, {
        params: z.object({
            id: z.string(),
        }),
        response: ApiUtils.mapReponseModel(ResourceModel),
        detail: { summary: 'Get resource by id', security: [{ bearerAuth: [] }] }
    });
```

## Required Route Shape

- Start each route module with `new Elysia().derive(ApiUtils.deriveFunc)` so handlers receive `identity`.
- Import `ApiUtils` from `src/server/utils/api-response.utils`.
- Import `ApiUnauthorizedException`, `ApiNotFoundException`, and `ServiceException` from `src/shared/model/service.exception.model` as needed.
- Declare `query`, `params`, and `body` directly in route options with Zod schemas.
- Declare `response` with `ApiUtils.mapReponseModel(successSchema)`.
- Keep OpenAPI metadata in `detail`, with a short `summary` and `security: [{ bearerAuth: [] }]` for protected routes.

## Handler Rules

- If `identity` is missing, throw `new ApiUnauthorizedException()`.
- If a requested resource does not exist, throw `new ApiNotFoundException()`.
- Use shared authorization helpers such as `ensureReadApp`, `ensureWriteApp`, `ensureCreateAppInProject`, `ensureDeleteAppInProject`, `ensureReadProject`, and `ensureAdmin`.
- Let shared authorization helpers throw; do not duplicate permission checks inline except for simple admin/read filtering already established in list routes.
- Throw `ServiceException` for expected domain validation errors, such as immutable `projectId` violations.
- Return success payloads directly; do not wrap them in `{ data }`, `{ status }`, or error envelopes.
- Do not return `ApiUtils.problem(...)`, raw `Response`, or Elysia `status(...)` for expected route errors.

## Schema Rules

- Use inline Zod objects for simple route params and query inputs.
- Use existing write schemas, such as `AppExtendedWriteZodModel` or a local `projectWriteSchema`, for bodies.
- Do not parse `query`, `params`, or `body` inside the handler if the route option already declares the schema.
- Do not use nested `schema: { query, params, body }` in these route modules.
- For delete routes, return `undefined` and declare `response: ApiUtils.mapReponseModel(z.undefined())`.
- For deployment request routes, return `{ deploymentId }` and declare `response: ApiUtils.mapReponseModel(z.object({ deploymentId: z.string() }))`.

## Write Route Pattern

Use POST upsert semantics:

```ts
.post('/projects', async ({ body, identity }) => {
    if (!identity) throw new ApiUnauthorizedException()

    ensureAdmin(identity);

    let existing: Project | null = null;
    if (body.id) {
        existing = await projectService.getByIdOrUndefined(body.id);
        if (!existing) throw new ApiNotFoundException();
    }

    return projectService.save({ id: existing?.id, name: body.name });
}, {
    body: projectWriteSchema,
    response: ApiUtils.mapReponseModel(ProjectModel),
    detail: { summary: 'Create or update project', security: [{ bearerAuth: [] }] }
})
```

## Validation Checklist

- Run `yarn tsc --noEmit` after route changes.
- Check that every accepted input has a route-level Zod schema.
- Check that every route has `response: ApiUtils.mapReponseModel(...)`.
- Check that expected failures are thrown as exceptions and mapped centrally by `ApiUtils.mapError(...)`.
- Check `CONTEXT.md` for REST API domain terms and write semantics before changing behavior.
