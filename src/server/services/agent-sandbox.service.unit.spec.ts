const execMocks = vi.hoisted(() => ({
    exec: vi.fn(),
}));

import stream from 'stream';

vi.mock('@kubernetes/client-node', () => ({
    Exec: class {
        exec = execMocks.exec;
    },
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        getKubeConfig: vi.fn(() => ({})),
        core: {
            listNamespacedPod: vi.fn(),
        },
    },
}));

vi.mock('@/server/adapter/agent-sandbox.adapter', () => ({
    default: {
        getSandboxClaim: vi.fn(),
        getSandbox: vi.fn(),
    },
}));

vi.mock('@/server/services/agent-runtime.service', () => ({
    default: {
        startSandbox: vi.fn(),
        stopSandbox: vi.fn(),
        listSandboxes: vi.fn(),
    },
}));

vi.mock('@/server/services/agent.service', () => ({
    default: {
        getByIdOrUndefined: vi.fn(),
    },
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import agentSandboxAdapter from '@/server/adapter/agent-sandbox.adapter';
import agentRuntimeService from '@/server/services/agent-runtime.service';
import agentService from '@/server/services/agent.service';
import agentSandboxService from './agent-sandbox.service';

const AGENT_ID = 'agent-1';
const CLAIM_NAME = 'ac-agent-1-abc';
const SANDBOX_NAME = 'sandbox-1';
const NAMESPACE = 'proj-1';
const POD_NAME = 'sandbox-pod-1';

async function streamToText(input: AsyncIterable<Buffer | string>): Promise<string> {
    let text = '';
    for await (const chunk of input) text += chunk.toString();
    return text;
}

function mockAgent() {
    return {
        id: AGENT_ID,
        projectId: NAMESPACE,
    };
}

function mockClaim(overrides: Record<string, any> = {}) {
    return {
        metadata: {
            name: CLAIM_NAME,
            namespace: NAMESPACE,
            creationTimestamp: '2026-01-01T00:00:00.000Z',
            labels: {
                'qs-agent-id': AGENT_ID,
            },
        },
        status: {
            sandbox: { name: SANDBOX_NAME },
            conditions: [{ type: 'Ready', status: 'True' }],
        },
        ...overrides,
    };
}

function mockSandbox(overrides: Record<string, any> = {}) {
    return {
        metadata: {
            name: SANDBOX_NAME,
            namespace: NAMESPACE,
        },
        status: {
            selector: 'agents.x-k8s.io/sandbox=sandbox-1',
        },
        ...overrides,
    };
}

function mockPod(overrides: Record<string, any> = {}) {
    return {
        metadata: { name: POD_NAME },
        spec: { containers: [{ name: 'agent' }] },
        status: { phase: 'Running' },
        ...overrides,
    };
}

function mockSuccessfulExec(stdout = '', stderr = '') {
    execMocks.exec.mockImplementation((
        _namespace: string,
        _podName: string,
        _containerName: string,
        _command: string[],
        stdoutStream: NodeJS.WritableStream,
        stderrStream: NodeJS.WritableStream,
        _stdinStream: NodeJS.ReadableStream | null,
        _tty: boolean,
        callback: (status: any) => void,
    ) => {
        stdoutStream.write(stdout);
        stderrStream.write(stderr);
        callback({ status: 'Success' });
        return Promise.resolve();
    });
}

describe('agent-sandbox.service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(agentService.getByIdOrUndefined).mockResolvedValue(mockAgent() as any);
        vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim() as any);
        vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue(mockSandbox() as any);
        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({ items: [mockPod()] } as any);
        vi.mocked(agentRuntimeService.startSandbox).mockResolvedValue({ sandboxName: CLAIM_NAME });
        vi.mocked(agentRuntimeService.listSandboxes).mockResolvedValue([
            { name: CLAIM_NAME, namespace: NAMESPACE, status: 'DEPLOYED', createdAt: '2026-01-01T00:00:00.000Z' },
        ]);
        mockSuccessfulExec();
    });

    it('creates a sandbox, waits through runtime service, and returns mapped sandbox info', async () => {
        const result = await agentSandboxService.createSandbox(AGENT_ID, 'user-1', 123_000, {
            env: { FOO: 'bar' },
            idleTimeoutMinutes: 15,
        });

        expect(agentRuntimeService.startSandbox).toHaveBeenCalledWith(AGENT_ID, 'user-1', {
            timeoutMs: 123_000,
            env: { FOO: 'bar' },
            idleTimeoutMinutes: 15,
        });
        expect(result).toEqual({
            agentId: AGENT_ID,
            sandboxName: CLAIM_NAME,
            podName: POD_NAME,
            namespace: NAMESPACE,
            status: 'DEPLOYED',
            createdAt: '2026-01-01T00:00:00.000Z',
            customTag: null,
        });
    });

    it('forwards customTag on create and maps it from claim annotations', async () => {
        vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim({
            metadata: {
                name: CLAIM_NAME,
                namespace: NAMESPACE,
                creationTimestamp: '2026-01-01T00:00:00.000Z',
                labels: {
                    'qs-agent-id': AGENT_ID,
                },
                annotations: {
                    'qs-custom-tag': 'feature-branch',
                },
            },
        }) as any);

        const result = await agentSandboxService.createSandbox(AGENT_ID, 'user-1', 123_000, {
            customTag: 'feature-branch',
        });

        expect(agentRuntimeService.startSandbox).toHaveBeenCalledWith(AGENT_ID, 'user-1', {
            timeoutMs: 123_000,
            customTag: 'feature-branch',
        });
        expect(result.customTag).toBe('feature-branch');
    });

    it('rejects a claim owned by another agent', async () => {
        vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(mockClaim({
            metadata: {
                labels: { 'qs-agent-id': 'other-agent' },
            },
        }) as any);

        await expect(agentSandboxService.getSandbox(AGENT_ID, CLAIM_NAME))
            .rejects.toThrow('Agent sandbox does not belong to this Agent.');
    });

    it('deletes sandbox through runtime service after validating claim ownership', async () => {
        await agentSandboxService.deleteSandbox(AGENT_ID, CLAIM_NAME);

        expect(agentRuntimeService.stopSandbox).toHaveBeenCalledWith(AGENT_ID, CLAIM_NAME);
    });

    it('handles missing claim', async () => {
        vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue(null);

        await expect(agentSandboxService.getSandbox(AGENT_ID, CLAIM_NAME))
            .rejects.toThrow('Agent sandbox not found.');
    });

    it('handles missing sandbox runtime', async () => {
        vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue(null);

        await expect(agentSandboxService.getSandbox(AGENT_ID, CLAIM_NAME))
            .rejects.toThrow('Agent sandbox runtime not found.');
    });

    it('handles missing pod', async () => {
        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({ items: [] } as any);

        await expect(agentSandboxService.getSandbox(AGENT_ID, CLAIM_NAME))
            .rejects.toThrow('Agent sandbox pod not found.');
    });

    it('runs a command and returns stdout, stderr, and exit code', async () => {
        mockSuccessfulExec('hello\n', 'warn\n');

        const result = await agentSandboxService.runCommand(AGENT_ID, CLAIM_NAME, { command: 'echo hello' });

        expect(result).toEqual({
            stdout: 'hello\n',
            stderr: 'warn\n',
            exitCode: 0,
        });
        expect(execMocks.exec).toHaveBeenCalledWith(
            NAMESPACE,
            POD_NAME,
            'agent',
            ['sh', '-lc', "timeout 120s sh -lc 'echo hello'"],
            expect.anything(),
            expect.anything(),
            null,
            false,
            expect.any(Function),
        );
    });

    it('runs commands with cwd, timeout, and env', async () => {
        mockSuccessfulExec('done\n');

        await agentSandboxService.runCommand(AGENT_ID, CLAIM_NAME, {
            command: 'npm test',
            cwd: '/workspace/app',
            timeoutSec: 30,
            env: { NODE_ENV: 'test' },
        });

        expect(execMocks.exec).toHaveBeenCalledWith(
            NAMESPACE,
            POD_NAME,
            'agent',
            ['sh', '-lc', "cd '/workspace/app' && NODE_ENV='test' timeout 30s sh -lc 'npm test'"],
            expect.anything(),
            expect.anything(),
            null,
            false,
            expect.any(Function),
        );
    });

    it('rejects invalid command env names', async () => {
        await expect(agentSandboxService.runCommand(AGENT_ID, CLAIM_NAME, {
            command: 'echo hi',
            env: { 'BAD-NAME': 'x' },
        })).rejects.toThrow('Invalid environment variable name "BAD-NAME".');
    });

    it('writes relative paths without path restrictions', async () => {
        await agentSandboxService.writeFile(AGENT_ID, CLAIM_NAME, '../dir/file.txt', stream.Readable.from(['Hello']));

        expect(execMocks.exec).toHaveBeenCalled();
    });

    it('rejects when a hung exec never invokes its status callback', async () => {
        vi.useFakeTimers();
        execMocks.exec.mockReturnValue(new Promise(() => {}));

        const result = agentSandboxService.runCommand(AGENT_ID, CLAIM_NAME, {
            command: 'echo hello',
            timeoutSec: 1,
        });
        const expectation = expect(result).rejects.toThrow('Command execution timed out or the sandbox connection was lost.');
        await vi.advanceTimersByTimeAsync(6_000);

        await expectation;
        vi.useRealTimers();
    });

    it('streams raw file bytes and exposes the file size', async () => {
        let callCount = 0;
        execMocks.exec.mockImplementation((
            _namespace: string,
            _podName: string,
            _containerName: string,
            _command: string[],
            stdoutStream: NodeJS.WritableStream,
            _stderrStream: NodeJS.WritableStream,
            _stdinStream: NodeJS.ReadableStream | null,
            _tty: boolean,
            callback: (status: any) => void,
        ) => {
            callCount += 1;
            stdoutStream.write(callCount === 1 ? '5\n' : 'Hello');
            callback({ status: 'Success' });
            return Promise.resolve();
        });

        const result = await agentSandboxService.readFile(AGENT_ID, CLAIM_NAME, '/tmp/hello.txt');

        expect(result.size).toBe(5);
        await expect(streamToText(result.stream)).resolves.toBe('Hello');
    });

    it('streams raw file content over stdin instead of placing it in the shell command', async () => {
        const content = 'A'.repeat(250_000);

        await agentSandboxService.writeFile(AGENT_ID, CLAIM_NAME, '/workspace/upload.bin', stream.Readable.from([content]));

        expect(execMocks.exec).toHaveBeenCalledWith(
            NAMESPACE,
            POD_NAME,
            'agent',
            ['sh', '-lc', "cat > '/workspace/upload.bin'"],
            expect.anything(),
            expect.anything(),
            expect.anything(),
            false,
            expect.any(Function),
        );
        expect(execMocks.exec.mock.calls[0][3].join('')).not.toContain(content);
    });

    it('checks file existence from command exit code', async () => {
        execMocks.exec.mockImplementation((
            _namespace: string,
            _podName: string,
            _containerName: string,
            _command: string[],
            _stdoutStream: NodeJS.WritableStream,
            _stderrStream: NodeJS.WritableStream,
            _stdinStream: NodeJS.ReadableStream | null,
            _tty: boolean,
            callback: (status: any) => void,
        ) => {
            callback({ status: 'Failure', details: { causes: [{ reason: 'ExitCode', message: '1' }] } });
            return Promise.resolve();
        });

        await expect(agentSandboxService.fileExists(AGENT_ID, CLAIM_NAME, '/missing'))
            .resolves.toEqual({ exists: false });
    });
});
