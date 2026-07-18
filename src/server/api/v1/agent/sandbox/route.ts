import { Elysia } from 'elysia';
import { z } from 'zod';
import agentSandboxService from '@/server/services/agent-sandbox.service';
import agentService from '@/server/services/agent.service';
import {
    ensureReadAgent,
    ensureWriteAgent,
} from '@/server/utils/shared-authorization.utils';
import {
    agentSandboxZodModel,
    commandRequestZodModel,
    commandResultZodModel,
    createSandboxRequestZodModel,
    fileEntryZodModel,
    fileExistsResultZodModel,
    fileReadResultZodModel,
    fileTextReadResultZodModel,
    fileTextWriteRequestZodModel,
    fileWriteRequestZodModel,
} from '@/shared/model/agent-sandbox.model';
import { ApiNotFoundException, ApiUnauthorizedException } from '@/shared/model/service.exception.model';
import { ApiUtils } from '@/server/utils/api-response.utils';

const agentSandboxParamsSchema = z.object({
    agentId: z.string(),
});

const agentSandboxClaimParamsSchema = z.object({
    agentId: z.string(),
    claimName: z.string(),
});

const filePathQuerySchema = z.object({
    path: z.string().min(1),
});

async function ensureAgentExists(agentId: string) {
    const agent = await agentService.getByIdOrUndefined(agentId);
    if (!agent) throw new ApiNotFoundException();
    return agent;
}

export const agentSandboxRoutes = new Elysia()
    .derive(ApiUtils.deriveFunc)
    .get('/agents/:agentId/sandboxes', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        return agentSandboxService.listSandboxes(params.agentId);
    }, {
        params: agentSandboxParamsSchema,
        response: ApiUtils.mapReponseModel(z.array(agentSandboxZodModel)),
        detail: {
            summary: 'List agent sandboxes',
            operationId: 'listAgentSandboxes',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .post('/agents/:agentId/sandboxes', async ({ params, query, body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        return agentSandboxService.createSandbox(params.agentId, identity.session.userId, query?.timeoutMs ?? 300_000, body);
    }, {
        params: agentSandboxParamsSchema,
        query: z.object({
            timeoutMs: z.coerce.number().int().positive().max(900_000).optional().default(300_000),
        }),
        body: createSandboxRequestZodModel,
        response: ApiUtils.mapReponseModel(agentSandboxZodModel),
        detail: {
            summary: 'Create agent sandbox',
            operationId: 'createAgentSandbox',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:claimName', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        return agentSandboxService.getSandbox(params.agentId, params.claimName);
    }, {
        params: agentSandboxClaimParamsSchema,
        response: ApiUtils.mapReponseModel(agentSandboxZodModel),
        detail: {
            summary: 'Get agent sandbox',
            operationId: 'getAgentSandbox',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .delete('/agents/:agentId/sandboxes/:claimName', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        await agentSandboxService.deleteSandbox(params.agentId, params.claimName);
        return undefined;
    }, {
        params: agentSandboxClaimParamsSchema,
        response: ApiUtils.mapReponseModel(z.undefined()),
        detail: {
            summary: 'Delete agent sandbox',
            operationId: 'deleteAgentSandbox',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .post('/agents/:agentId/sandboxes/:claimName/commands', async ({ params, body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        return agentSandboxService.runCommand(params.agentId, params.claimName, body);
    }, {
        params: agentSandboxClaimParamsSchema,
        body: commandRequestZodModel,
        response: ApiUtils.mapReponseModel(commandResultZodModel),
        detail: {
            summary: 'Run command in agent sandbox',
            operationId: 'runAgentSandboxCommand',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:claimName/files/read-text', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        return agentSandboxService.readTextFile(params.agentId, params.claimName, query.path);
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        response: ApiUtils.mapReponseModel(fileTextReadResultZodModel),
        detail: {
            summary: 'Read text file from agent sandbox',
            operationId: 'readAgentSandboxTextFile',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:claimName/files/read', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        return agentSandboxService.readFile(params.agentId, params.claimName, query.path);
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        response: ApiUtils.mapReponseModel(fileReadResultZodModel),
        detail: {
            summary: 'Read file from agent sandbox',
            operationId: 'readAgentSandboxFile',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .put('/agents/:agentId/sandboxes/:claimName/files/write-text', async ({ params, body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        await agentSandboxService.writeTextFile(params.agentId, params.claimName, body.path, body.text);
        return undefined;
    }, {
        params: agentSandboxClaimParamsSchema,
        body: fileTextWriteRequestZodModel,
        response: ApiUtils.mapReponseModel(z.undefined()),
        detail: {
            summary: 'Write text file to agent sandbox',
            operationId: 'writeAgentSandboxTextFile',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .put('/agents/:agentId/sandboxes/:claimName/files/write', async ({ params, body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        await agentSandboxService.writeFile(params.agentId, params.claimName, body.path, body.dataBase64);
        return undefined;
    }, {
        params: agentSandboxClaimParamsSchema,
        body: fileWriteRequestZodModel,
        response: ApiUtils.mapReponseModel(z.undefined()),
        detail: {
            summary: 'Write file to agent sandbox',
            operationId: 'writeAgentSandboxFile',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:claimName/files/list', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        return agentSandboxService.listFiles(params.agentId, params.claimName, query.path);
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        response: ApiUtils.mapReponseModel(z.array(fileEntryZodModel)),
        detail: {
            summary: 'List files in agent sandbox',
            operationId: 'listAgentSandboxFiles',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:claimName/files/exists', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        return agentSandboxService.fileExists(params.agentId, params.claimName, query.path);
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        response: ApiUtils.mapReponseModel(fileExistsResultZodModel),
        detail: {
            summary: 'Check file exists in agent sandbox',
            operationId: 'checkAgentSandboxFileExists',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    });
