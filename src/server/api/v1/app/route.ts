import { Elysia } from 'elysia';
import { z } from 'zod';
import appService from '@/server/services/app.service';
import appLogsService from '@/server/services/standalone-services/app-logs.service';
import {
    ensureCreateAppInProject,
    ensureDeleteAppInProject,
    ensureReadApp,
    ensureWriteApp,
} from '@/server/utils/shared-authorization.utils';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { AppExtendedWriteModel, AppExtendedWriteZodModel, AppExtendedZodModel } from '@/shared/model/app-extended.model';
import { ApiUtils } from '../../../utils/api-response.utils';
import { ApiNotFoundException, ApiUnauthorizedException, ServiceException } from '@/shared/model/service.exception.model';
import { appLogsResponseZodModel } from '@/shared/model/app-tail-log-entry';

export const appRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/apps', async ({ query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const apps = query.projectId ? await appService.getAllAppsByProjectID(query.projectId) : await appService.getAll();

        if (UserGroupUtils.isAdmin(identity.session)) {
            return apps;
        }

        return apps.filter(app =>
            UserGroupUtils.sessionHasReadAccessForApp(identity.session, app.id)
        );
    }, {
        query: z.object({
            projectId: z.string().optional(),
        }),
        response: ApiUtils.mapReponseModel(z.array(AppExtendedZodModel)),
        detail: { summary: 'List apps', security: [{ bearerAuth: [] }] }
    })
    .get('/apps/:appId', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureReadApp(identity, app.id);

        return appService.getExtendedById(app.id);
    }, {
        params: z.object({
            appId: z.string(),
        }),
        response: ApiUtils.mapReponseModel(AppExtendedZodModel),
        detail: { summary: 'Get app', security: [{ bearerAuth: [] }] }
    })
    .get('/apps/:appId/logs', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureReadApp(identity, app.id);

        const logs = await appLogsService.getCurrentLogs(app.id, query.lines);
        return {
            appId: app.id,
            lines: query.lines,
            logs,
        };
    }, {
        params: z.object({
            appId: z.string(),
        }),
        query: z.object({
            lines: z.coerce.number().int().positive().max(5000).optional().default(200)
        }),
        response: ApiUtils.mapReponseModel(appLogsResponseZodModel),
        detail: { summary: 'Get current app logs', security: [{ bearerAuth: [] }] }
    })
    .post('/apps', async ({ body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        let existing: AppExtendedWriteModel | null = null;
        if (!body.id) {
            ensureCreateAppInProject(identity, body.projectId);
        } else {
            existing = await appService.getExtendedById(body.id, false).catch(() => null);
            if (!existing) throw new ApiNotFoundException();

            ensureWriteApp(identity, existing.id!);

            if (body.projectId !== existing.projectId) {
                throw new ServiceException('projectId cannot be changed for an existing app.');
            }
        }
        return await appService.saveAppExtendedModel({ ...existing, ...body });
    }, {
        body: AppExtendedWriteZodModel,
        response: ApiUtils.mapReponseModel(AppExtendedZodModel),
        detail: { summary: 'Create or update app', security: [{ bearerAuth: [] }] }
    })
    .delete('/apps/:id', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const existing = await appService.getByIdOrUndefined(params.id);
        if (!existing) throw new ApiNotFoundException();

        ensureDeleteAppInProject(identity, existing.projectId);

        await appService.deleteById(existing.id);
        return undefined;
    }, {
        params: z.object({
            id: z.string(),
        }),
        response: ApiUtils.mapReponseModel(z.undefined()),
        detail: { summary: 'Delete app', security: [{ bearerAuth: [] }] }
    });
