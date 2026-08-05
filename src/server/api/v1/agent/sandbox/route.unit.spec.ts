const routeMocks = vi.hoisted(() => ({
    identity: null as any,
    getByIdOrUndefined: vi.fn(),
    createSandbox: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    runCommand: vi.fn(),
    listFiles: vi.fn(),
    fileExists: vi.fn(),
    ensureReadAgent: vi.fn(),
    ensureWriteAgent: vi.fn(),
}));

vi.mock('@/server/utils/api-response.utils', () => ({
    ApiUtils: {
        deriveFunc: () => ({ identity: routeMocks.identity }),
        mapResponseModel: (schema: unknown) => ({ 200: schema }),
        mapError: (error: any) => new Response(JSON.stringify({ title: error.title ?? 'Error' }), {
            status: error.statusCode ?? 500,
        }),
        toJsonSchema: vi.fn(),
    },
}));

vi.mock('@/server/services/agent.service', () => ({
    default: {
        getByIdOrUndefined: routeMocks.getByIdOrUndefined,
    },
}));

vi.mock('@/server/services/agent-sandbox.service', () => ({
    default: {
        listSandboxes: vi.fn(),
        createSandbox: routeMocks.createSandbox,
        getSandbox: vi.fn(),
        deleteSandbox: vi.fn(),
        runCommand: routeMocks.runCommand,
        readFile: routeMocks.readFile,
        writeFile: routeMocks.writeFile,
        listFiles: routeMocks.listFiles,
        fileExists: routeMocks.fileExists,
    },
}));

vi.mock('@/server/utils/shared-authorization.utils', () => ({
    ensureReadAgent: routeMocks.ensureReadAgent,
    ensureWriteAgent: routeMocks.ensureWriteAgent,
}));

import { Elysia } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import stream from 'stream';
import { ApiUtils } from '@/server/utils/api-response.utils';
import { ServiceException } from '@/shared/model/service.exception.model';
import { agentSandboxRoutes } from './route';

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('agent sandbox routes', () => {
    const app = new Elysia()
        .onError(({ error }) => ApiUtils.mapError(error))
        .use(agentSandboxRoutes);

    beforeEach(() => {
        vi.resetAllMocks();
        routeMocks.identity = {
            type: 'apiKey',
            session: {
                userId: 'user-1',
                email: 'user@example.com',
            },
        };
        routeMocks.getByIdOrUndefined.mockResolvedValue({ id: 'agent-1', projectId: 'proj-1' });
        routeMocks.createSandbox.mockResolvedValue({
            agentId: 'agent-1',
            sandboxName: 'ac-agent-1',
            podName: 'pod-1',
            namespace: 'proj-1',
            status: 'DEPLOYED',
            customTag: null,
            createdAt: '2026-01-01T00:00:00.000Z',
        });
        routeMocks.runCommand.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
        routeMocks.readFile.mockResolvedValue({ stream: stream.PassThrough.from([Buffer.from('hello')]), size: 5 });
        routeMocks.writeFile.mockResolvedValue(undefined);
        routeMocks.listFiles.mockResolvedValue([]);
        routeMocks.fileExists.mockResolvedValue({ exists: true });
    });

    it('passes create env and idle timeout body to service', async () => {
        const response = await app.handle(new Request('http://localhost/agents/agent-1/sandboxes?timeoutMs=120000', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                env: { FOO: 'bar' },
                idleTimeoutMinutes: 5,
                customTag: 'feature-branch',
            }),
        }));

        expect(response.status).toBe(200);
        expect(routeMocks.createSandbox).toHaveBeenCalledWith('agent-1', 'user-1', 120_000, {
            env: { FOO: 'bar' },
            idleTimeoutMinutes: 5,
            customTag: 'feature-branch',
        });
    });

    it('passes command options to service', async () => {
        const body = {
            command: 'npm test',
            cwd: '/workspace/app',
            timeoutSec: 30,
            env: { NODE_ENV: 'test' },
        };

        const response = await app.handle(new Request('http://localhost/agents/agent-1/sandboxes/ac-1/commands', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }));

        expect(response.status).toBe(200);
        expect(routeMocks.runCommand).toHaveBeenCalledWith('agent-1', 'ac-1', body);
    });

    it('streams raw file routes', async () => {
        const readResponse = await app.handle(new Request('http://localhost/agents/agent-1/sandboxes/ac-1/files/read?path=%2Fworkspace%2FAGENTS.md'));
        const writeResponse = await app.handle(new Request('http://localhost/agents/agent-1/sandboxes/ac-1/files/write?path=%2Fworkspace%2FAGENTS.md', {
            method: 'PUT',
            headers: { 'content-type': 'application/octet-stream' },
            body: 'hello',
        }));

        expect(readResponse.status).toBe(200);
        expect(await readResponse.text()).toBe('hello');
        expect(readResponse.headers.get('content-length')).toBe('5');
        expect(writeResponse.status).toBe(200);
        expect(routeMocks.readFile).toHaveBeenCalledWith('agent-1', 'ac-1', '/workspace/AGENTS.md');
        expect(routeMocks.writeFile).toHaveBeenCalledWith('agent-1', 'ac-1', '/workspace/AGENTS.md', expect.any(stream.Readable));
        expect(routeMocks.ensureWriteAgent).toHaveBeenCalledWith(routeMocks.identity, 'agent-1');
    });

    it('documents file writes as a multipart binary request body', async () => {
        const documentedApp = new Elysia()
            .use(openapi({ path: '/openapi', specPath: '/openapi.json' }))
            .use(agentSandboxRoutes);

        const response = await documentedApp.handle(new Request('http://localhost/openapi.json'));
        const document = await response.json() as any;
        const requestBody = document.paths['/agents/{agentId}/sandboxes/{sandboxName}/files/write'].put.requestBody;

        expect(requestBody).toEqual({
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
        });
    });

    it('rejects file reads for an identity without write access', async () => {
        routeMocks.ensureWriteAgent.mockImplementation(() => {
            throw new ServiceException('User is not authorized for this action.');
        });

        const response = await app.handle(new Request('http://localhost/agents/agent-1/sandboxes/ac-1/files/read?path=%2Fworkspace%2FAGENTS.md'));

        expect(response.status).not.toBe(200);
        expect(routeMocks.readFile).not.toHaveBeenCalled();
    });

    it('requires write access for every file inspection endpoint', async () => {
        const urls = ['files/read', 'files/list', 'files/exists'];

        for (const endpoint of urls) {
            const response = await app.handle(new Request(`http://localhost/agents/agent-1/sandboxes/ac-1/${endpoint}?path=%2Fworkspace%2FAGENTS.md`));
            expect(response.status).toBe(200);
        }

        expect(routeMocks.ensureWriteAgent).toHaveBeenCalledTimes(3);
        expect(routeMocks.ensureReadAgent).not.toHaveBeenCalled();
    });
});
