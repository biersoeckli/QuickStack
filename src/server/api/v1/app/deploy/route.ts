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
import paginationUtils, { paginationQueryZodModel } from '@/shared/utils/pagination.utils';

export const appDeployRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/apps/:appId/deploy', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const app = await appService.getByIdOrUndefined(params.appId);
        if (!app) throw new ApiNotFoundException();

        ensureReadApp(identity, app.id);

        const deplyoments = (await deploymentService.getDeploymentHistory(app.projectId, app.id))
            .map(deployment => ({
                ...deployment,
                appId: app.id,
            }));

        return paginationUtils.isRequested(query)
            ? paginationUtils.page(deplyoments, query)
            : deplyoments;
    }, {
        params: z.object({
            appId: z.string()
        }),
        query: paginationQueryZodModel,
        response: ApiUtils.mapResponseModel(paginationUtils.responseSchema(deploymentDetailsResponseZodModel)),
        detail: {
            summary: 'List app deployments',
            description: 'Returns the deployment history as an array. Set limit (and optionally cursor) for the paginated envelope. Poll this after deployApp until the newest entry reports success or failure.',
            operationId: 'listAppDeployments',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }],
        }
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
        response: ApiUtils.mapResponseModel(deploymentDetailsResponseZodModel),
        detail: { summary: 'Get app deployment', operationId: 'getAppDeployment', tags: ['Apps'], security: [{ bearerAuth: [] }] }
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
        response: ApiUtils.mapResponseModel(appDeploymentLogsResponseZodModel),
        detail: {
            summary: 'Get app deployment logs',
            description: 'Returns build/deploy logs for one deployment. Keep tailLines small (max 5000); large responses are truncated by MCP clients.',
            operationId: 'getAppDeploymentLogs',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }],
        }
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
        response: ApiUtils.mapResponseModel(z.object({ deploymentId: z.string() })),
        detail: {
            summary: 'Deploy app',
            description: `Starts a build and rollout and returns {"deploymentId":"..."} immediately. Pass query.forceRebuild=true to rebuild even when the commit/image did not change.
Example: POST /api/v1/apps/<appId>/deploy?forceRebuild=true.
Poll listAppDeployments or getAppDeployment with that deploymentId until the status is successful or failed. On failure, call getAppDeploymentLogs to inspect the build logs. This changes live Kubernetes workloads; ask for confirmation first.`,
            operationId: 'deployApp',
            tags: ['Apps'],
            security: [{ bearerAuth: [] }]
        }
    });
