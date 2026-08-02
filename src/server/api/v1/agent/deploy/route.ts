import { Elysia } from 'elysia';
import { z } from 'zod';
import agentService from '@/server/services/agent.service';
import {
    ensureWriteProjectWorkload,
} from '@/server/utils/shared-authorization.utils';
import { ApiNotFoundException, ApiUnauthorizedException } from '@/shared/model/service.exception.model';
import { ApiUtils } from '@/server/utils/api-response.utils';

export const agentDeployRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .post('/agents/:agentId/deploy', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const agent = await agentService.getByIdOrUndefined(params.agentId);
        if (!agent) throw new ApiNotFoundException();

        ensureWriteProjectWorkload(identity, agent.id);

        const deploymentId = await agentService.deploy(agent.id, query.forceRebuild);
        return { deploymentId };
    }, {
        params: z.object({
            agentId: z.string(),
        }),
        query: z.object({
            forceRebuild: z.coerce.boolean().optional().default(false),
        }),
        response: ApiUtils.mapResponseModel(z.object({ deploymentId: z.string() })),
        detail: {
            summary: 'Deploy agent configuration',
            description: 'Deploys the agent with the given ID. This does not start any agent sandbox, it just applies the configuration to kubernetes (SandboxTemplate). Every new agent sandbox created after this deployment will use the newly applied configuration. This can only be done, wehen no sandbox is running.',
            operationId: 'deployAgent',
            tags: ['Agents'],
            security: [{ bearerAuth: [] }]
        }
    });
