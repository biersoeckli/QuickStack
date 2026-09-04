import { Elysia } from 'elysia';
import stream from 'stream';
import { posix as path } from 'path';
import { z } from 'zod';
import agentSandboxService from '@/server/services/agent-sandbox.service';
import agentService from '@/server/services/agent.service';
import {
    ensureReadAgent,
    ensureWriteAgent,
} from '@/server/utils/shared-authorization.utils';
import agentDomainService from '@/server/services/agent-domain.service';

import {
    agentSandboxAccessUrlZodModel,
    agentSandboxZodModel,
    commandRequestZodModel,
    commandResultZodModel,
    createSandboxRequestZodModel as startSandboxRequestZodModel,
    fileEntryZodModel,
    fileExistsResultZodModel,
} from '@/shared/model/agent-sandbox.model';
import { ApiNotFoundException, ApiUnauthorizedException } from '@/shared/model/service.exception.model';
import { ApiUtils } from '@/server/utils/api-response.utils';
import agentAccessService from '@/server/services/agent-access.service';
import { FileUploadUtils } from '@/server/utils/file-upload.utils';

const agentSandboxParamsSchema = z.object({
    agentId: z.string(),
});

const agentSandboxClaimParamsSchema = z.object({
    agentId: z.string(),
    sandboxName: z.string(),
});

const agentSandboxAccessUrlParamsSchema = z.object({
    agentId: z.string(),
    sandboxName: z.string(),
    domainId: z.string(),
});

const filePathQuerySchema = z.object({
    path: z.string().min(1),
});

function fileHeaders(filePath: string, size: number): Headers {
    const filename = path.basename(filePath) || 'download';
    return new Headers({
        'content-type': 'application/octet-stream',
        'content-length': `${size}`,
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
}

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
        response: ApiUtils.mapResponseModel(z.array(agentSandboxZodModel)),
        detail: {
            summary: 'List agent sandboxes',
            description: 'List all running agent sandboxes for the given agent ID.',
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
        body: startSandboxRequestZodModel,
        response: ApiUtils.mapResponseModel(agentSandboxZodModel),
        detail: {
            summary: 'Start agent sandbox',
            operationId: 'startAgentSandbox',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:sandboxName', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        return agentSandboxService.getSandbox(params.agentId, params.sandboxName);
    }, {
        params: agentSandboxClaimParamsSchema,
        response: ApiUtils.mapResponseModel(agentSandboxZodModel),
        detail: {
            summary: 'Get agent sandbox',
            operationId: 'getAgentSandbox',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:sandboxName/accessUrl/:domainId', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureReadAgent(identity, params.agentId);

        const domain = await agentDomainService.getDomainForAgent(params.agentId, params.domainId);
        if (!domain) {
            throw new ApiNotFoundException('Domain not found for agent.');
        }

        return await agentAccessService.createAccessUrl({
            agentId: params.agentId,
            sandboxName: params.sandboxName,
            domainId: params.domainId,
            view: 'agent',
            session: identity.session,
        });
    }, {
        params: agentSandboxAccessUrlParamsSchema,
        response: ApiUtils.mapResponseModel(agentSandboxAccessUrlZodModel),
        detail: {
            summary: 'Get agent sandbox access URL',
            description: 'Get a temporary access URL to access the agent sandbox via the browser. This is only possible if a domain is configured for the agent and the agent serves an API or Web interface.',
            operationId: 'getAgentSandboxAccessUrl',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .delete('/agents/:agentId/sandboxes/:sandboxName', async ({ params, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        await agentSandboxService.deleteSandbox(params.agentId, params.sandboxName);
        return undefined;
    }, {
        params: agentSandboxClaimParamsSchema,
        response: ApiUtils.mapResponseModel(z.undefined()),
        detail: {
            summary: 'Delete agent sandbox',
            operationId: 'deleteAgentSandbox',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .post('/agents/:agentId/sandboxes/:sandboxName/commands', async ({ params, body, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        return agentSandboxService.runCommand(params.agentId, params.sandboxName, body);
    }, {
        params: agentSandboxClaimParamsSchema,
        body: commandRequestZodModel,
        response: ApiUtils.mapResponseModel(commandResultZodModel),
        detail: {
            summary: 'Run command in agent sandbox',
            description: 'Run a shell command in a running Agent Sandbox. CLI harness templates stay alive with `sleep infinity`; invoke their documented `qs-*` wrapper here so it receives the Agent Runtime Secret and selected LiteLLM Model Alias.',
            operationId: 'runAgentSandboxCommand',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:sandboxName/files/read', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        const file = await agentSandboxService.readFile(params.agentId, params.sandboxName, query.path);
        return new Response(stream.Readable.toWeb(file.stream) as ReadableStream, { headers: fileHeaders(query.path, file.size) });
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        detail: {
            summary: 'Stream file from agent sandbox',
            description: 'Stream a file from an agent sandbox. Requires write access to the agent.',
            operationId: 'readAgentSandboxFile',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .put('/agents/:agentId/sandboxes/:sandboxName/files/write', async ({ params, query, request, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        await agentSandboxService.writeFile(
            params.agentId,
            params.sandboxName,
            query.path,
            await FileUploadUtils.getWriteFileStream(request),
        );
        return undefined;
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        // Parse manually so legacy octet-stream callers can still stream bytes.
        // swagger-typescript-api has no octet-stream ContentType and otherwise
        // serializes ArrayBuffer payloads as JSON.
        parse: 'none',
        response: ApiUtils.mapResponseModel(z.undefined()),
        detail: {
            summary: 'Stream file to agent sandbox',
            description: `Writes one file into the running sandbox. Existing content at \`path\` is replaced.

Use \`multipart/form-data\` and provide the upload in the required \`file\` field. This is the supported contract for generated OpenAPI clients.

\`swagger-typescript-api\` example:

\`\`\`ts
await client.writeAgentSandboxFile(
  { agentId, sandboxName, path: '/workspace/document.pdf' },
  { file }, // Browser File or Blob
);
\`\`\`

Do not JSON-serialize the file and do not wrap it in a \`body\` field. JSON serialization of an \`ArrayBuffer\` produces \`{}\` and writes that text to the sandbox file.

Two request formats are supported:

- \`multipart/form-data\`: required \`file\` field; preferred for generated OpenAPI clients.
- \`application/octet-stream\`: request body contains raw file bytes; preferred for direct or streaming HTTP clients.`,
            operationId: 'writeAgentSandboxFile',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    'multipart/form-data': {
                        schema: {
                            type: 'object',
                            required: ['file'],
                            properties: {
                                file: {
                                    type: 'string',
                                    format: 'binary',
                                },
                            },
                        },
                    },
                    'application/octet-stream': {
                        schema: {
                            type: 'string',
                            format: 'binary',
                        },
                    },
                },
            },
        },
    })
    .get('/agents/:agentId/sandboxes/:sandboxName/files/list', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        return agentSandboxService.listFiles(params.agentId, params.sandboxName, query.path);
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        response: ApiUtils.mapResponseModel(z.array(fileEntryZodModel)),
        detail: {
            summary: 'List files in agent sandbox',
            description: 'List files in an agent sandbox. Requires write access to the agent.',
            operationId: 'listAgentSandboxFiles',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    })
    .get('/agents/:agentId/sandboxes/:sandboxName/files/exists', async ({ params, query, identity }) => {
        if (!identity) throw new ApiUnauthorizedException();

        await ensureAgentExists(params.agentId);
        ensureWriteAgent(identity, params.agentId);

        return agentSandboxService.fileExists(params.agentId, params.sandboxName, query.path);
    }, {
        params: agentSandboxClaimParamsSchema,
        query: filePathQuerySchema,
        response: ApiUtils.mapResponseModel(fileExistsResultZodModel),
        detail: {
            summary: 'Check file exists in agent sandbox',
            description: 'Check a file in an agent sandbox. Requires write access to the agent.',
            operationId: 'checkAgentSandboxFileExists',
            tags: ['Agent Sandboxes'],
            security: [{ bearerAuth: [] }],
        },
    });
