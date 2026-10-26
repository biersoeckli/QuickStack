const { mockExecFn, mockWaitUntilPodIsRunning } = vi.hoisted(() => ({
    mockExecFn: vi.fn(),
    mockWaitUntilPodIsRunning: vi.fn(),
}));

vi.mock('@kubernetes/client-node', () => {
    function MockExec() {
        return { exec: mockExecFn };
    }
    return {
        Exec: MockExec,
        V1Status: Object,
    };
});

vi.mock('@/server/services/standalone-services/standalone-pod.service', () => ({
    default: {
        waitUntilPodIsRunningFailedOrSucceded: mockWaitUntilPodIsRunning,
    },
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        getKubeConfig: vi.fn().mockReturnValue({}),
        core: { readNamespacedPod: vi.fn() },
    },
}));

vi.mock('@/shared/utils/stream.utils', () => ({
    StreamUtils: {
        getInputStreamName: (info: any) => `${info.terminalSessionKey}_input`,
        getOutputStreamName: (info: any) => `${info.terminalSessionKey}_output`,
    },
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: { client: {
        user: { findUnique: vi.fn() },
        app: { findUnique: vi.fn() },
        agent: { findUnique: vi.fn() },
    } },
}));
vi.mock('@/server/services/standalone-services/user-group-query.service', () => ({
    default: { getRoleByUserMail: vi.fn() },
}));
import dataAccess from '@/server/adapter/db.client';
import userGroupQueryService from '@/server/services/standalone-services/user-group-query.service';
import terminalService from './terminal.service';
import k3s from '@/server/adapter/kubernetes-api.adapter';
import { TerminalSetupInfoModel } from '@/shared/model/terminal-setup-info.model';

const sockets: ReturnType<typeof makeSocket>[] = [];

function makeSocket(): any {
    const events: Record<string, any> = {};
    const socket = {
        connected: true,
        data: { terminalAuthentication: { userId: 'user-1', expiresAt: Date.now() + 60000 } },
        off: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn((event: string, handler: any) => {
            events[event] = handler;
        }),
        emit: vi.fn(),
        id: `socket-${Math.random().toString(36).slice(2)}`,
        _events: events,
    } as any;
    sockets.push(socket);
    return socket;
}

function makeTerminalInfo(overrides: Partial<TerminalSetupInfoModel> = {}): TerminalSetupInfoModel {
    return {
        namespace: 'proj-1',
        podName: 'agent-pod-1',
        containerName: 'agent',
        terminalType: 'opencode',
        terminalSessionKey: `proj-1-agent-pod-1-agent-opencode-${Date.now()}`,
        ...overrides,
    };
}

describe('terminal.service', () => {
    afterEach(() => {
        for (const socket of sockets.splice(0)) socket._events.disconnecting?.();
        vi.useRealTimers();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        mockWaitUntilPodIsRunning.mockResolvedValue(true);
        mockExecFn.mockResolvedValue({ close: vi.fn(), on: vi.fn() });
        vi.mocked(dataAccess.client.user.findUnique).mockResolvedValue({ id: 'user-1', email: 'user@example.com', apiOnlyUser: false } as any);
        vi.mocked(dataAccess.client.app.findUnique).mockResolvedValue({ id: 'app-1', projectId: 'proj-1' } as any);
        vi.mocked(userGroupQueryService.getRoleByUserMail).mockResolvedValue({
            name: 'writer', id: 'role-1', canAccessBackups: false,
            roleProjectPermissions: [{
                projectId: 'proj-1', project: { projectWorkloads: [{ id: 'app-1', name: 'App' }] },
                writeWorkloads: true, readWorkloads: true, createWorkloads: false, deleteWorkloads: false,
                workloadPermissions: [],
            }],
        });
        vi.mocked(k3s.core.readNamespacedPod).mockResolvedValue({
            metadata: { uid: 'pod-uid', namespace: 'proj-1', annotations: { 'qs-app-id': 'app-1' } },
            spec: { containers: [{ name: 'agent' }] },
        });
    });

    it('rejects an unauthenticated socket before Kubernetes exec', async () => {
        const socket = makeSocket();
        socket.data = {};
        await terminalService.streamTerminal(socket);
        await socket._events.openTerminal?.(makeTerminalInfo());
        expect(mockExecFn).not.toHaveBeenCalled();
    });

    it.each(['read-only', 'other-workload', 'deleted-user', 'expired', 'system', 'wrong-project', 'missing-label', 'ambiguous', 'unknown-container'])('rejects %s terminal access', async (scenario) => {
        const socket = makeSocket();
        const info = makeTerminalInfo();
        if (scenario === 'read-only') {
            const role = await userGroupQueryService.getRoleByUserMail('user@example.com');
            role!.roleProjectPermissions[0].writeWorkloads = false;
        }
        if (scenario === 'other-workload') {
            const role = await userGroupQueryService.getRoleByUserMail('user@example.com');
            role!.roleProjectPermissions[0].project.projectWorkloads = [];
        }
        if (scenario === 'deleted-user') vi.mocked(dataAccess.client.user.findUnique).mockResolvedValue(null);
        if (scenario === 'expired') socket.data.terminalAuthentication.expiresAt = Date.now() - 1;
        if (scenario === 'system') info.namespace = 'quickstack';
        if (scenario === 'wrong-project') info.namespace = 'other-project';
        if (scenario === 'unknown-container') info.containerName = 'management';
        if (scenario === 'missing-label' || scenario === 'ambiguous') {
            vi.mocked(k3s.core.readNamespacedPod).mockResolvedValue({
                metadata: { uid: 'pod-uid', namespace: 'proj-1', annotations: scenario === 'ambiguous'
                    ? { 'qs-app-id': 'app-1', 'qs-agent-id': 'agent-2' } : {} },
                spec: { containers: [{ name: 'agent' }] },
            });
        }
        await terminalService.streamTerminal(socket);
        await socket._events.openTerminal?.(info);
        expect(mockExecFn).not.toHaveBeenCalled();
    });

    it('opens a labeled Agent in its own project', async () => {
        vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue({ id: 'app-1', projectId: 'proj-1' } as any);
        vi.mocked(k3s.core.readNamespacedPod).mockResolvedValue({
            metadata: { uid: 'agent-uid', namespace: 'proj-1', labels: { 'qs-agent-id': 'app-1' } },
            spec: { containers: [{ name: 'agent' }] },
        });
        const socket = makeSocket();
        await terminalService.streamTerminal(socket);
        await socket._events.openTerminal(makeTerminalInfo());
        expect(mockExecFn).toHaveBeenCalledOnce();
    });

    it('closes exec and removes input listeners when write access is revoked', async () => {
        vi.useFakeTimers();
        const close = vi.fn();
        mockExecFn.mockResolvedValue({ close, on: vi.fn() });
        const socket = makeSocket();
        const info = makeTerminalInfo();
        await terminalService.streamTerminal(socket);
        await socket._events.openTerminal(info);
        vi.mocked(userGroupQueryService.getRoleByUserMail).mockResolvedValue(null);
        await vi.advanceTimersByTimeAsync(15000);
        expect(close).toHaveBeenCalledOnce();
        expect(socket.off).toHaveBeenCalledWith(`${info.terminalSessionKey}_input`, expect.any(Function));
    });

    it('ignores empty input without queuing authorization work', async () => {
        const socket = makeSocket();
        const info = makeTerminalInfo();
        await terminalService.streamTerminal(socket);
        await socket._events.openTerminal(info);
        const write = vi.spyOn(mockExecFn.mock.calls[0][6], 'write');
        await socket._events[`${info.terminalSessionKey}_input`]('');
        expect(write).not.toHaveBeenCalled();
    });

    it('blocks input after permission revocation', async () => {
        const socket = makeSocket();
        const info = makeTerminalInfo();
        await terminalService.streamTerminal(socket);
        await socket._events.openTerminal(info);
        const stdin = mockExecFn.mock.calls[0][6];
        const write = vi.spyOn(stdin, 'write');
        vi.mocked(userGroupQueryService.getRoleByUserMail).mockResolvedValue(null);
        await socket._events[`${info.terminalSessionKey}_input`]('id\n');
        expect(write).not.toHaveBeenCalled();
    });

    it('closes a late exec connection after disconnect during opening', async () => {
        let finish!: (value: any) => void;
        const close = vi.fn();
        mockExecFn.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const socket = makeSocket();
        await terminalService.streamTerminal(socket);
        const opening = socket._events.openTerminal(makeTerminalInfo());
        await vi.waitFor(() => expect(mockExecFn).toHaveBeenCalledOnce());
        socket._events.disconnecting();
        finish({ close, on: vi.fn() });
        await opening;
        expect(close).toHaveBeenCalledOnce();
    });

    it('closes exec at session expiry', async () => {
        vi.useFakeTimers();
        const socket = makeSocket();
        socket.data.terminalAuthentication.expiresAt = Date.now() + 1000;
        const close = vi.fn();
        mockExecFn.mockResolvedValue({ close, on: vi.fn() });
        await terminalService.streamTerminal(socket);
        await socket._events.openTerminal(makeTerminalInfo());
        await vi.advanceTimersByTimeAsync(1000);
        expect(close).toHaveBeenCalledOnce();
    });

    describe('command selection', () => {
        it('execs opencode command when terminalType is opencode', async () => {
            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo({ terminalType: 'opencode' });
            await socket._events.openTerminal(info);

            expect(mockExecFn).toHaveBeenCalledWith(
                'proj-1',
                'agent-pod-1',
                'agent',
                ['opencode'],
                expect.anything(),
                expect.anything(),
                expect.anything(),
                true,
                expect.any(Function),
            );
        });

        it('execs /bin/sh command when terminalType is sh', async () => {
            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo({ terminalType: 'sh' });
            await socket._events.openTerminal(info);

            expect(mockExecFn).toHaveBeenCalledWith(
                'proj-1',
                'agent-pod-1',
                'agent',
                ['/bin/sh'],
                expect.anything(),
                expect.anything(),
                expect.anything(),
                true,
                expect.any(Function),
            );
        });

        it('execs /bin/bash command when terminalType is bash', async () => {
            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo({ terminalType: 'bash' });
            await socket._events.openTerminal(info);

            expect(mockExecFn).toHaveBeenCalledWith(
                'proj-1',
                'agent-pod-1',
                'agent',
                ['/bin/bash'],
                expect.anything(),
                expect.anything(),
                expect.anything(),
                true,
                expect.any(Function),
            );
        });

        it('defaults to /bin/bash when terminalType is null/undefined', async () => {
            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo({ terminalType: null as any });
            await socket._events.openTerminal(info);

            expect(mockExecFn).toHaveBeenCalledWith(
                'proj-1',
                'agent-pod-1',
                'agent',
                ['/bin/bash'],
                expect.anything(),
                expect.anything(),
                expect.anything(),
                true,
                expect.any(Function),
            );
        });
    });

    describe('pod readiness', () => {
        it('emits error and does not exec when pod is not reachable', async () => {
            mockWaitUntilPodIsRunning.mockResolvedValue(false);

            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo();
            await socket._events.openTerminal(info);

            expect(socket.emit).toHaveBeenCalledWith(
                `${info.terminalSessionKey}_output`,
                'Pod is not reachable.',
            );
            expect(mockExecFn).not.toHaveBeenCalled();
        });
    });

    describe('exec failure', () => {
        it('emits error when exec status callback reports Failure', async () => {
            let statusCallback: Function = () => {};
            mockExecFn.mockImplementation(
                (_ns: any, _pod: any, _ctr: any, _cmd: any, _stdout: any, _stderr: any, _stdin: any, _tty: any, cb: Function) => {
                    statusCallback = cb;
                    return Promise.resolve({ close: vi.fn(), on: vi.fn() });
                },
            );

            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo({ terminalType: 'opencode' });
            const outKey = `${info.terminalSessionKey}_output`;

            await socket._events.openTerminal(info);

            statusCallback({ status: 'Failure', message: 'command not found: opencode' });

            const emitCalls = (socket.emit as any).mock.calls.filter(
                (c: any[]) => c[0] === outKey,
            );
            const messages = emitCalls.map((c: any[]) => c[1]).join('');
            expect(messages).toContain('[ERROR]');
        });

        it('shows exit info when exec exits successfully', async () => {
            let statusCallback: Function = () => {};
            mockExecFn.mockImplementation(
                (_ns: any, _pod: any, _ctr: any, _cmd: any, _stdout: any, _stderr: any, _stdin: any, _tty: any, cb: Function) => {
                    statusCallback = cb;
                    return Promise.resolve({ close: vi.fn(), on: vi.fn() });
                },
            );

            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo();
            const outKey = `${info.terminalSessionKey}_output`;

            await socket._events.openTerminal(info);

            statusCallback({ status: 'Success' });

            const emitCalls = (socket.emit as any).mock.calls.filter(
                (c: any[]) => c[0] === outKey,
            );
            const messages = emitCalls.map((c: any[]) => c[1]).join('');
            expect(messages).toContain('[INFO] Terminal session closed');
        });
    });

    describe('session cleanup', () => {
        it('cleans up terminal streams on closeTerminal event', async () => {
            const socket = makeSocket();
            await terminalService.streamTerminal(socket);

            const info = makeTerminalInfo();
            await socket._events.openTerminal(info);

            await socket._events.closeTerminal(info);

            // Should not throw
        });
    });
});
