import { Elysia } from 'elysia';
import { z } from 'zod';
import appService from '@/server/services/app.service';
import appLogsService from '@/server/services/standalone-services/app-logs.service';
import appCommandService from '@/server/services/app-command.service';
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
import { commandRequestZodModel, commandResultZodModel } from '@/shared/model/agent-sandbox.model';
import paginationUtils, { paginationQueryZodModel } from '@/shared/utils/pagination.utils';

function stripAppSubObjectIdsForCreate(body: AppExtendedWriteModel): AppExtendedWriteModel {
    return {
        ...body,
        appDomains: body.appDomains.map(({ id: _id, ...domain }) => domain),
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

        const apps = query.projectId ? await appService.getAllAppsByProjectId(query.projectId) : await appService.getAll();

        const visibleApps = UserGroupUtils.isAdmin(identity.session)
            ? apps
            : apps.filter(app =>
                UserGroupUtils.sessionHasReadAccessForApp(identity.session, app.id)
            );

        return paginationUtils.isRequested(query)
            ? paginationUtils.page(visibleApps, query)
            : visibleApps;
    }, {
        query: paginationQueryZodModel.extend({
            projectId: z.string().optional(),
        }),
        response: ApiUtils.mapResponseModel(paginationUtils.responseSchema(AppExtendedZodModel)),
        detail: {
            summary: 'List apps',
            description: 'Returns all apps as an array. Set limit (and optionally cursor) to receive the paginated envelope { items, total, limit, nextCursor } instead.',
            operationId: 'listApps',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }],
        }
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
        detail: {
            summary: 'Get current app logs',
            description: 'Returns the current log tail of the app. Keep `lines` small (default 200, max 5000); large responses are truncated by MCP clients.',
            operationId: 'getAppLogs',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }],
        }
    })
    .post('/apps/:appId/commands', async ({ params, body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureWriteApp(identity, app.id);

        return appCommandService.runCommand(app.id, body);
    }, {
        params: z.object({
            appId: z.string(),
        }),
        body: commandRequestZodModel,
        response: ApiUtils.mapResponseModel(commandResultZodModel),
        detail: {
            summary: 'Run command in app',
            description: `Run a shell command in the first running Pod of this app. Requires write access to the app.
Example: {"command":"ls -la /app","cwd":"/app","timeoutSec":120}
Returns stdout, stderr and exitCode. The command is executed inside the live Pod and can modify application data.`,
            operationId: 'runAppCommand',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }],
        },
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
            description: `Upsert one App.
- Omit id to create: projectId is required. appDomains, appNodePorts, appFileMounts, appVolumes and appBasicAuths are required arrays (empty allowed), and appNetworkPolicy must be null or an object.
- Send id to update: projectId must equal the existing app's projectId and cannot be changed. The request replaces the stored app, so omitted or empty sub-resource arrays delete the existing entries. Call getApp first, then send the full object back with the ids of sub-resources you want to keep.
- This only saves desired state. Call deployApp afterwards to roll it out. Saving revalidates server caches but does not change Kubernetes resources.

Example create:
{"name":"web","appType":"APP","projectId":"<projectId>","sourceType":"CONTAINER","buildMethod":"RAILPACK","containerImageSource":"nginx:1.27","dockerfilePath":"./Dockerfile","replicas":1,"envVars":"","buildArgs":"","useNetworkPolicy":true,"healthCheckPeriodSeconds":15,"healthCheckTimeoutSeconds":5,"healthCheckFailureThreshold":3,"appDomains":[{"hostname":"web.example.com","port":80,"useSsl":true,"redirectHttps":true}],"appNodePorts":[],"appFileMounts":[],"appVolumes":[],"appBasicAuths":[],"appNetworkPolicy":null}

Example update (read getApp first and keep all sub-resource ids you do not want to delete):
{"id":"<appId>","name":"web","appType":"APP","projectId":"<projectId>","sourceType":"CONTAINER","buildMethod":"DOCKERFILE","containerImageSource":"nginx:1.27","dockerfilePath":"./Dockerfile","replicas":2,"envVars":"","buildArgs":"","useNetworkPolicy":true,"healthCheckPeriodSeconds":15,"healthCheckTimeoutSeconds":5,"healthCheckFailureThreshold":3,"appDomains":[{"id":"<domainId>","hostname":"web.example.com","port":80,"useSsl":true,"redirectHttps":true}],"appNodePorts":[],"appFileMounts":[],"appVolumes":[],"appBasicAuths":[],"appNetworkPolicy":null}`,
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
        detail: {
            summary: 'Delete app',
            description: 'Permanently deletes the app and its sub-resources (domains, volumes, file mounts, basic auth). No request body.\nExample: DELETE /api/v1/apps/<appId>.\nRequires confirmation because this cannot be undone.',
            operationId: 'deleteApp',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }],
        }
    });
