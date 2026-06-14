import { Elysia } from 'elysia';
import { z } from 'zod';
import appService from '@/server/services/app.service';
import deploymentLogService from '@/server/services/deployment-logs.service';
import deploymentService from '@/server/services/deployment.service';
import {
    ensureReadApp,
    ensureWriteApp,
} from '@/server/utils/shared-authorization.utils';
import { ApiNotFoundException, ApiUnauthorizedException } from '@/shared/model/service.exception.model';
import { appDeploymentLogsResponseZodModel } from '@/shared/model/app-tail-log-entry';
import { deploymentDetailsResponseZodModel } from '@/shared/model/deployment-info.model';
import { ApiUtils } from '@/server/utils/api-response.utils';

export const deployRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/apps/:appId/deploy', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureReadApp(identity, app.id);

        const deplyoments = await deploymentService.getDeploymentHistory(app.projectId, app.id);
        return deplyoments.map(deployment => ({
            ...deployment,
            appId: app.id,
        }));
    }, {
        params: z.object({
            appId: z.string()
        }),
        response: ApiUtils.mapReponseModel(deploymentDetailsResponseZodModel.array()),
        detail: { summary: 'List app deployments', security: [{ bearerAuth: [] }] }
    })
    .get('/apps/:appId/deploy/:deployemtId', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureReadApp(identity, app.id);

        const deployment = await deploymentService.getDeploymentHistoryEntryById(app.projectId, app.id, params.deployemtId);
        if (!deployment) throw new ApiNotFoundException();

        return {
            ...deployment,
            appId: app.id,
        };
    }, {
        params: z.object({
            appId: z.string(),
            deployemtId: z.string(),
        }),
        response: ApiUtils.mapReponseModel(deploymentDetailsResponseZodModel),
        detail: { summary: 'Get app deployment', security: [{ bearerAuth: [] }] }
    })
    .get('/apps/:appId/deploy/:deployemtId/logs', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureReadApp(identity, app.id);

        const deployment = await deploymentService.getDeploymentHistoryEntryById(app.projectId, app.id, params.deployemtId);
        if (!deployment) throw new ApiNotFoundException();

        const logs = await deploymentLogService.getLogsById(params.deployemtId, query.tailLines ?? undefined);
        return {
            appId: app.id,
            deplyomentId: deployment.deploymentId,
            tailLines: query.tailLines ?? null,
            logs,
        };
    }, {
        params: z.object({
            appId: z.string(),
            deployemtId: z.string(),
        }),
        query: z.object({
            tailLines: z.coerce.number().int().positive().max(5000).optional(),
        }),
        response: ApiUtils.mapReponseModel(appDeploymentLogsResponseZodModel),
        detail: { summary: 'Get app deployment logs', security: [{ bearerAuth: [] }] }
    })
    .post('/apps/:appId/deploy', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureWriteApp(identity, app.id);

        const deploymentId = await appService.buildAndDeploy(app.id, params.forceRebuild);
        return { deploymentId };
    }, {
        params: z.object({
            appId: z.string(),
            forceRebuild: z.coerce.boolean().optional().default(false),
        }),
        response: ApiUtils.mapReponseModel(z.object({ deploymentId: z.string() })),
        detail: { summary: 'Deploy app', security: [{ bearerAuth: [] }] }
    });
