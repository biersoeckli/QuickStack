import { Elysia } from 'elysia';
import { z } from 'zod';
import projectService from '@/server/services/project.service';
import { ensureAdmin, ensureReadProject } from '@/server/utils/shared-authorization.utils';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { ProjectModel } from '@/shared/model/generated-zod';
import { ApiUtils } from '../../../utils/api-response.utils';
import { ApiOperationDetailUtils } from '@/server/utils/api-operation-detail.utils';
import { Project } from '@prisma/client';
import { ApiNotFoundException, ApiUnauthorizedException } from '@/shared/model/service.exception.model';
import paginationUtils, { paginationQueryZodModel } from '@/shared/utils/pagination.utils';

const projectWriteSchema = ProjectModel
    .omit({ createdAt: true, updatedAt: true })
    .extend({
        id: z.string().optional(),
    });

export const projectRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/projects', async ({ query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const projects = await projectService.getAll();

        const visibleProjects = UserGroupUtils.isAdmin(identity.session)
            ? projects
            : projects.filter(project =>
                UserGroupUtils.sessionHasReadAccessToProject(identity.session, project.id)
            );

        return paginationUtils.isRequested(query)
            ? paginationUtils.page(visibleProjects, query)
            : visibleProjects;
    }, {
        query: paginationQueryZodModel,
        response: ApiUtils.mapResponseModel(paginationUtils.responseSchema(ProjectModel)),
        detail: {
            summary: 'List projects',
            description: 'Returns all projects as an array. Set limit (and optionally cursor) to receive the paginated envelope { items, total, limit, nextCursor } instead.',
            operationId: 'listProjects',
            tags: ['Projects'],
            security: [{ bearerAuth: [] }],
        }

    })
    .get('/projects/:id', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const project = await projectService.getById(params.id);
        if (!project) throw new ApiNotFoundException();

        ensureReadProject(identity, project.id);

        return project;
    }, {
        params: z.object({
            id: z.string(),
        }),
        response: ApiUtils.mapResponseModel(ProjectModel),
        detail: { summary: 'Get project', operationId: 'getProject', tags: ['Projects'], security: [{ bearerAuth: [] }] }
    })
    .post('/projects', async ({ body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        ensureAdmin(identity);

        let existing: Project | null = null;
        if (body.id) {
            existing = await projectService.getByIdOrUndefined(body.id);
            if (!existing) throw new ApiNotFoundException();
        }
        return await projectService.save({
            id: existing?.id,
            name: body.name,
        });
    }, {
        body: projectWriteSchema,
        response: ApiUtils.mapResponseModel(ProjectModel),
        detail: ApiOperationDetailUtils.create({
            summary: 'Create or update project',
            description: 'Creates a project when id is omitted, otherwise updates the existing project. Requires admin.',
            'x-mcp-description': `Upsert one project. Omit id to create; send id to update an existing project.
Example create: {"name":"team-demo"}
Example update: {"id":"<projectId>","name":"team-demo-renamed"}
Requires admin. Every project maps to a Kubernetes namespace; saveProject only stores metadata, deployApp or deployAgent creates the namespace.`,
            operationId: 'saveProject',
            tags: ['Projects'],
            security: [{ bearerAuth: [] }],
        })
    })
    .delete('/projects/:id', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()
        ensureAdmin(identity);

        const existing = await projectService.getByIdOrUndefined(params.id);
        if (!existing) throw new ApiNotFoundException();

        await projectService.deleteById(params.id);
        return undefined;
    }, {
        params: z.object({
            id: z.string(),
        }),
        response: ApiUtils.mapResponseModel(z.undefined()),
        detail: ApiOperationDetailUtils.create({
            summary: 'Delete project',
            description: 'Permanently deletes the project, all its Apps and Agents, and the Kubernetes namespace with their workloads and volumes. Requires admin.',
            'x-mcp-description': 'Permanently deletes the project, all its Apps and Agents, and the Kubernetes namespace with their workloads and volumes. No request body.\nExample: DELETE /api/v1/projects/<projectId>.\nRequires admin and confirmation because this cannot be undone.',
            operationId: 'deleteProject',
            tags: ['Projects'],
            security: [{ bearerAuth: [] }],
        })
    });
