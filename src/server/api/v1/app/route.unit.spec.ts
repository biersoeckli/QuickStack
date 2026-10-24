const mocks = vi.hoisted(() => ({
    identity: null as any,
    getByIdOrUndefined: vi.fn(),
    runCommand: vi.fn(),
    ensureWriteApp: vi.fn(),
}));

vi.mock('@/server/utils/api-response.utils', () => ({
    ApiUtils: {
        deriveFunc: () => ({ identity: mocks.identity }),
        mapResponseModel: (schema: unknown) => ({ 200: schema }),
        mapError: (error: any) => new Response(JSON.stringify({ title: error.title ?? 'Error' }), {
            status: error.statusCode ?? 500,
        }),
    },
}));
vi.mock('@/server/services/app.service', () => ({
    default: { getByIdOrUndefined: mocks.getByIdOrUndefined },
}));
vi.mock('@/server/services/app-command.service', () => ({
    default: { runCommand: mocks.runCommand },
}));
vi.mock('@/server/services/standalone-services/app-logs.service', () => ({ default: {} }));
vi.mock('@/server/utils/shared-authorization.utils', () => ({
    ensureCreateAppInProject: vi.fn(),
    ensureDeleteAppInProject: vi.fn(),
    ensureReadAgent: vi.fn(),
    ensureReadApp: vi.fn(),
    ensureWriteApp: mocks.ensureWriteApp,
}));

import { Elysia } from 'elysia';
import { ApiUtils } from '@/server/utils/api-response.utils';
import { appRoutes } from './route';

describe('app command route', () => {
    const app = new Elysia()
        .onError(({ error }) => ApiUtils.mapError(error))
        .use(appRoutes);

    beforeEach(() => {
        vi.resetAllMocks();
        mocks.identity = { session: { userId: 'user-1' } };
        mocks.getByIdOrUndefined.mockResolvedValue({ id: 'app-1', projectId: 'project-1' });
        mocks.runCommand.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    });

    it('runs the command after checking write access', async () => {
        const body = { command: 'npm test', cwd: '/workspace', timeoutSec: 30, env: { CI: 'true' } };
        const response = await app.handle(new Request('http://localhost/apps/app-1/commands', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ stdout: 'ok', stderr: '', exitCode: 0 });
        expect(mocks.ensureWriteApp).toHaveBeenCalledWith(mocks.identity, 'app-1');
        expect(mocks.runCommand).toHaveBeenCalledWith('app-1', body);
    });

    it('does not execute a command for an unknown app', async () => {
        mocks.getByIdOrUndefined.mockResolvedValue(null);
        const response = await app.handle(new Request('http://localhost/apps/app-1/commands', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ command: 'pwd' }),
        }));

        expect(response.status).toBe(404);
        expect(mocks.runCommand).not.toHaveBeenCalled();
    });
});
