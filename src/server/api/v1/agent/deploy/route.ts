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
            description: 'Deploys the agent configuration with the given ID. This does not start any agent sandbox; it only applies the configuration to Kubernetes (SandboxTemplate). Every new agent sandbox created after this deployment uses the newly applied configuration. This can only be done when no sandbox is running. For CONTAINER sources the SandboxTemplate is applied before the call returns. For GIT/GIT_SSH sources the build continues asynchronously after the returned deploymentId; follow its progress in the QuickStack UI and poll listAgentSandboxes before starting a sandbox.\nExample: POST /api/v1/agents/<agentId>/deploy?forceRebuild=false.\nThis changes live Kubernetes resources; ask for confirmation first.',
            operationId: 'deployAgent',
            tags: ['Agents'],
            security: [{ bearerAuth: [] }]
        }
    });
