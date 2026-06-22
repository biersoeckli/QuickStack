import { Elysia } from 'elysia';
import { z } from 'zod';
import projectService from '@/server/services/project.service';
import { ensureAdmin, ensureReadProject } from '@/server/utils/shared-authorization.utils';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { ProjectModel } from '@/shared/model/generated-zod';
import { ApiUtils } from '../../../utils/api-response.utils';
import { Project } from '@prisma/client';
import { ApiNotFoundException, ApiUnauthorizedException } from '@/shared/model/service.exception.model';
import { ProjectTypeModel } from '@/shared/model/project-type.model';

const projectWriteSchema = ProjectModel
    .omit({ createdAt: true, updatedAt: true })
    .extend({
        id: z.string().optional(),
        projectType: ProjectTypeModel,
    });

export const projectRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/projects', async ({ identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const projects = await projectService.getAll();

        if (UserGroupUtils.isAdmin(identity.session)) {
            return projects;
        }

        return projects.filter(project =>
            UserGroupUtils.sessionHasReadAccessToProject(identity.session, project.id)
        );
    }, {
        response: ApiUtils.mapReponseModel(z.array(ProjectModel)),
        detail: { summary: 'List projects', security: [{ bearerAuth: [] }] }

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
        response: ApiUtils.mapReponseModel(ProjectModel),
        detail: { summary: 'Get project', security: [{ bearerAuth: [] }] }
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
            projectType: body.projectType,
        });
    }, {
        body: projectWriteSchema,
        response: ApiUtils.mapReponseModel(ProjectModel),
        detail: { summary: 'Create or update project', security: [{ bearerAuth: [] }] }
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
        response: ApiUtils.mapReponseModel(z.undefined()),
        detail: { summary: 'Delete project', security: [{ bearerAuth: [] }] }
    });
