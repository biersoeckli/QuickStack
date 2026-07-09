import { Elysia } from 'elysia';
import { z } from 'zod';
import agentService from '@/server/services/agent.service';
import {
    ensureCreateAgentInProject,
    ensureDeleteProjectWorkloadInProject,
    ensureReadProjectWorkload,
    ensureWriteProjectWorkload,
} from '@/server/utils/shared-authorization.utils';
import { UserGroupUtils } from '@/shared/utils/role.utils';
import { AgentExtendedWriteModel, AgentExtendedWriteZodModel, AgentExtendedZodModel } from '@/shared/model/agent-extended.model';
import { ApiUtils } from '../../../utils/api-response.utils';
import { ApiNotFoundException, ApiUnauthorizedException, ServiceException } from '@/shared/model/service.exception.model';

export const agentRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/agents', async ({ query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const agents = query.projectId ? await agentService.getAllByProjectId(query.projectId) : await agentService.getAll();

        if (UserGroupUtils.isAdmin(identity.session)) {
            return agents;
        }

        return agents.filter(agent =>
            UserGroupUtils.sessionHasReadAccessForProjectWorkload(identity.session, agent.id)
        );
    }, {
        query: z.object({
            projectId: z.string().optional(),
        }),
        response: ApiUtils.mapReponseModel(z.array(AgentExtendedZodModel)),
        detail: { summary: 'List agents', security: [{ bearerAuth: [] }] }
    })
    .get('/agents/:agentId', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const agent = await agentService.getByIdOrUndefined(params.agentId);
        if (!agent) throw new ApiNotFoundException();

        ensureReadProjectWorkload(identity, agent.id);

        return agent;
    }, {
        params: z.object({
            agentId: z.string(),
        }),
        response: ApiUtils.mapReponseModel(AgentExtendedZodModel),
        detail: { summary: 'Get agent', security: [{ bearerAuth: [] }] }
    })
    .post('/agents', async ({ body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        let existing: AgentExtendedWriteModel | null = null;
        if (!body.id) {
            ensureCreateAgentInProject(identity, body.projectId);
        } else {
            existing = await agentService.getByIdOrUndefined(body.id);
            if (!existing) throw new ApiNotFoundException();

            ensureWriteProjectWorkload(identity, existing.id!);

            if (body.projectId !== existing.projectId) {
                throw new ServiceException('projectId cannot be changed for an existing agent.');
            }
        }

        return await agentService.saveAgentExtendedModel(body);
    }, {
        body: AgentExtendedWriteZodModel,
        response: ApiUtils.mapReponseModel(AgentExtendedZodModel),
        detail: {
            summary: 'Create or update agent.',
            description: 'When an ID is set, the agent will be updated. Otherwise a new one will be created.',
            security: [{ bearerAuth: [] }]
        }
    })
    .delete('/agents/:id', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const existing = await agentService.getByIdOrUndefined(params.id);
        if (!existing) throw new ApiNotFoundException();

        ensureDeleteProjectWorkloadInProject(identity, existing.projectId);

        await agentService.deleteById(existing.id);
        return undefined;
    }, {
        params: z.object({
            id: z.string(),
        }),
        response: ApiUtils.mapReponseModel(z.undefined()),
        detail: { summary: 'Delete agent', security: [{ bearerAuth: [] }] }
    });
