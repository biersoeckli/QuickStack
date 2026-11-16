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
import { AgentExtendedModel, AgentExtendedWriteModel, AgentExtendedWriteZodModel, AgentExtendedZodModel } from '@/shared/model/agent-extended.model';
import { ApiUtils } from '../../../utils/api-response.utils';
import { ApiOperationDetailUtils } from '@/server/utils/api-operation-detail.utils';
import { ApiNotFoundException, ApiUnauthorizedException, ServiceException } from '@/shared/model/service.exception.model';
import paginationUtils, { paginationQueryZodModel } from '@/shared/utils/pagination.utils';

function stripAgentSubObjectIdsForCreate(body: AgentExtendedWriteModel): AgentExtendedWriteModel {
    const agentNetworkPolicy = body.agentNetworkPolicy
        ? (() => {
            const { id: _id, rules, ...policy } = body.agentNetworkPolicy;
            return {
                ...policy,
                rules: rules.map(({ id: _ruleId, ...rule }) => rule),
            };
        })()
        : body.agentNetworkPolicy;

    return {
        ...body,
        agentDomains: body.agentDomains.map(({ id: _id, ...domain }) => domain),
        agentVolumes: body.agentVolumes.map(({ id: _id, ...volume }) => volume),
        agentFileMounts: body.agentFileMounts.map(({ id: _id, ...fileMount }) => fileMount),
        agentNetworkPolicy,
    };
}

export const agentRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/agents', async ({ query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const agents = query.projectId ? await agentService.getAllByProjectId(query.projectId) : await agentService.getAll();

        const visibleAgents = UserGroupUtils.isAdmin(identity.session)
            ? agents
            : agents.filter(agent =>
                UserGroupUtils.sessionHasReadAccessForProjectWorkload(identity.session, agent.id)
            );

        return paginationUtils.page(visibleAgents, query);
    }, {
        query: paginationQueryZodModel.extend({
            projectId: z.string().optional(),
        }),
        response: ApiUtils.mapResponseModel(paginationUtils.envelopeSchema(AgentExtendedZodModel)),
        detail: {
            summary: 'List agents',
            description: 'Returns a paginated list of agents. The default limit is 50.',
            operationId: 'listAgents',
            tags: ['Agents'],
            security: [{ bearerAuth: [] }],
        }
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
        response: ApiUtils.mapResponseModel(AgentExtendedZodModel),
        detail: { summary: 'Get agent', operationId: 'getAgent', tags: ['Agents'], security: [{ bearerAuth: [] }] }
    })
    .post('/agents', async ({ body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        let existing: AgentExtendedModel | null = null;
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

        const saveBody = body.id ? body : stripAgentSubObjectIdsForCreate(body);
        return await agentService.saveAgentExtendedModel(saveBody);
    }, {
        body: AgentExtendedWriteZodModel,
        response: ApiUtils.mapResponseModel(AgentExtendedZodModel),
        detail: ApiOperationDetailUtils.create({
            summary: 'Create or update agent.',
            description: 'Creates an agent template when id is omitted, otherwise replaces the existing template. projectId cannot be changed. Call deployAgent afterwards to apply it.',
            'x-mcp-description': `Upsert one agent template.
- Omit id to create: projectId, llmGatewayId and modelAlias (non-empty array) are required. agentDomains, agentVolumes, agentFileMounts are required arrays, and agentNetworkPolicy must be null or an object. agentNetworkPolicy.allowTraefikAccess is optional and defaults to false.
- Send id to update: projectId must equal the existing agent's projectId and cannot be changed. The request replaces the stored agent, so omitted or empty sub-resource arrays delete the existing entries. Call getAgent first, then send the full object back with the ids of sub-resources you want to keep.
- When MCP secret redaction is enabled, getAgent omits gitToken and containerRegistryPassword. Obtain existing values from a secure source and include them when updating; do not substitute empty strings, which can overwrite secrets. If the values are unavailable, do not update the agent.
- This only saves the template. Call deployAgent to apply it, then startAgentSandbox to run a sandbox. Saving revalidates caches but does not create Kubernetes resources.

Example create:
{"name":"coder","projectId":"<projectId>","llmGatewayId":"<gatewayId>","modelAlias":["gpt-4o"],"sourceType":"CONTAINER","buildMethod":"DOCKERFILE","containerImageSource":"ghcr.io/example/agent:latest","dockerfilePath":"./Dockerfile","warmPoolReplicas":0,"deployFileBrowser":false,"healthCheckPeriodSeconds":15,"healthCheckTimeoutSeconds":5,"healthCheckFailureThreshold":3,"agentDomains":[],"agentVolumes":[],"agentFileMounts":[],"agentNetworkPolicy":null}

Example update (read getAgent first and keep all sub-resource ids you do not want to delete):
{"id":"<agentId>","name":"coder","projectId":"<projectId>","llmGatewayId":"<gatewayId>","modelAlias":["gpt-4o","gpt-4o-mini"],"sourceType":"CONTAINER","buildMethod":"DOCKERFILE","containerImageSource":"ghcr.io/example/agent:latest","dockerfilePath":"./Dockerfile","warmPoolReplicas":1,"deployFileBrowser":false,"healthCheckPeriodSeconds":15,"healthCheckTimeoutSeconds":5,"healthCheckFailureThreshold":3,"agentDomains":[],"agentVolumes":[{"id":"<volumeId>","containerMountPath":"/workspace","size":10,"storageClassName":"longhorn","volumeType":"PER_SANDBOX"}],"agentFileMounts":[],"agentNetworkPolicy":{"allowInternetAccess":true,"allowTraefikAccess":false,"rules":[]}}`,
            operationId: 'saveAgent',
            tags: ['Agents'],
            security: [{ bearerAuth: [] }]
        })
    })
    .delete('/agents/:agentId', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException()

        const existing = await agentService.getByIdOrUndefined(params.agentId);
        if (!existing) throw new ApiNotFoundException();

        ensureDeleteProjectWorkloadInProject(identity, existing.projectId);

        await agentService.deleteById(existing.id);
        return undefined;
    }, {
        params: z.object({
            agentId: z.string(),
        }),
        response: ApiUtils.mapResponseModel(z.undefined()),
        detail: ApiOperationDetailUtils.create({
            summary: 'Delete agent',
            description: 'Permanently deletes the agent template and its sub-resources (domains, volumes, file mounts, network policy).',
            'x-mcp-description': 'Permanently deletes the agent template and its sub-resources (domains, volumes, file mounts, network policy). No request body.\nRequires confirmation because this cannot be undone.',
            operationId: 'deleteAgent',
            tags: ['Agents'],
            security: [{ bearerAuth: [] }],
        })
    });
