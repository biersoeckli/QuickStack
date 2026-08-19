import { Elysia } from 'elysia';
import { z } from 'zod';
import appService from '@/server/services/app.service';
import appLogsService from '@/server/services/standalone-services/app-logs.service';
import {
    ensureCreateAppInProject,
    ensureDeleteAppInProject,
    ensureReadAgent,
    ensureReadApp,
    ensureWriteApp,
} from '@/server/utils/shared-authorization.utils';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { AppExtendedModel, AppExtendedWriteModel, AppExtendedWriteZodModel, AppExtendedZodModel } from '@/shared/model/app-extended.model';
import { ApiUtils } from '../../../utils/api-response.utils';
import { ApiNotFoundException, ApiUnauthorizedException, ServiceException } from '@/shared/model/service.exception.model';
import { appLogsResponseZodModel } from '@/shared/model/app-tail-log-entry';

function stripAppSubObjectIdsForCreate(body: AppExtendedWriteModel): AppExtendedWriteModel {
    return {
        ...body,
        appDomains: body.appDomains.map(({ id: _id, ...domain }) => domain),
        appPorts: body.appPorts.map(({ id: _id, ...port }) => port),
        appNodePorts: body.appNodePorts.map(({ id: _id, ...nodePort }) => nodePort),
        appFileMounts: body.appFileMounts.map(({ id: _id, ...fileMount }) => fileMount),
        appVolumes: body.appVolumes.map(({ id: _id, ...volume }) => volume),
        appBasicAuths: body.appBasicAuths.map(({ id: _id, ...basicAuth }) => basicAuth),
        appNetworkPolicy: body.appNetworkPolicy ? (() => {
            const { id: _id, ...policy } = body.appNetworkPolicy;
            return {
                ...policy,
                rules: policy.rules.map(({ id: _ruleId, ...rule }) => rule),
            };
        })() : null,
    };
}

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
        response: ApiUtils.mapResponseModel(z.array(AppExtendedZodModel)),
        detail: { summary: 'List apps', operationId: 'listApps', tags: ['Apps'], security: [{ bearerAuth: [] }] }
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
        response: ApiUtils.mapResponseModel(AppExtendedZodModel),
        detail: { summary: 'Get app', operationId: 'getApp', tags: ['Apps'], security: [{ bearerAuth: [] }] }
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
        response: ApiUtils.mapResponseModel(appLogsResponseZodModel),
        detail: { summary: 'Get current app logs', operationId: 'getAppLogs', tags: ['Apps'], security: [{ bearerAuth: [] }] }
    })
    .post('/apps', async ({ body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        let existing: AppExtendedModel | null = null;
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
        const saveBody = body.id ? body : stripAppSubObjectIdsForCreate(body);
        for (const rule of saveBody.appNetworkPolicy?.rules ?? []) {
            if (rule.targetAppId) ensureReadApp(identity, rule.targetAppId);
            if (rule.targetAgentId) ensureReadAgent(identity, rule.targetAgentId);
        }
        return await appService.saveAppExtendedModel(saveBody);
    }, {
        body: AppExtendedWriteZodModel,
        response: ApiUtils.mapResponseModel(AppExtendedZodModel),
        detail: {
            summary: 'Create or update app.',
            description: 'When an ID is set, the app will be updated. Otherwise a new one will be created.',
            operationId: 'saveApp',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }]
        }
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
        response: ApiUtils.mapResponseModel(z.undefined()),
        detail: { summary: 'Delete app', operationId: 'deleteApp', tags: ['Apps'], security: [{ bearerAuth: [] }] }
    });
