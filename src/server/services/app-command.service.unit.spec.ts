const mocks = vi.hoisted(() => ({
    getByIdOrUndefined: vi.fn(),
    getPodsForApp: vi.fn(),
    execInPod: vi.fn(),
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/services/app.service', () => ({
    default: { getByIdOrUndefined: mocks.getByIdOrUndefined },
}));
vi.mock('@/server/services/pod.service', () => ({
    default: { getPodsForApp: mocks.getPodsForApp, execInPod: mocks.execInPod },
}));

import appCommandService from './app-command.service';

describe('app-command.service', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mocks.getByIdOrUndefined.mockResolvedValue({ id: 'app-1', projectId: 'project-1' });
        mocks.getPodsForApp.mockResolvedValue([
            { podName: 'app-1-pending', containerName: 'app', status: 'Pending' },
            { podName: 'app-1-running', containerName: 'app', status: 'Running' },
        ]);
        mocks.execInPod.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    });

    it('executes in the first running app Pod with the sandbox command contract', async () => {
        await expect(appCommandService.runCommand('app-1', {
            command: "echo '$GREETING'",
            cwd: '/workspace/app',
            timeoutSec: 30,
            env: { GREETING: 'hello' },
        })).resolves.toEqual({ stdout: 'ok', stderr: '', exitCode: 0 });

        expect(mocks.execInPod).toHaveBeenCalledWith(
            'project-1',
            'app-1-running',
            'app',
            ['sh', '-lc', "cd '/workspace/app' && GREETING='hello' timeout 30s sh -lc 'echo '\\''$GREETING'\\'''"],
            30,
        );
    });

    it('rejects commands when the app has no running Pod', async () => {
        mocks.getPodsForApp.mockResolvedValue([{ podName: 'app-1-pending', containerName: 'app', status: 'Pending' }]);

        await expect(appCommandService.runCommand('app-1', { command: 'pwd' }))
            .rejects.toThrow('App has no running Pod to execute the command in.');
    });
});
