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
    },
}));

vi.mock('@/shared/utils/stream.utils', () => ({
    StreamUtils: {
        getInputStreamName: (info: any) => `${info.terminalSessionKey}_input`,
        getOutputStreamName: (info: any) => `${info.terminalSessionKey}_output`,
    },
}));

import terminalService from './terminal.service';
import { TerminalSetupInfoModel } from '@/shared/model/terminal-setup-info.model';

function makeSocket() {
    const events: Record<string, any> = {};
    return {
        on: vi.fn((event: string, handler: any) => {
            events[event] = handler;
        }),
        emit: vi.fn(),
        id: `socket-${Math.random().toString(36).slice(2)}`,
        _events: events,
    } as any;
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
    beforeEach(() => {
        vi.clearAllMocks();
        mockWaitUntilPodIsRunning.mockResolvedValue(true);
        mockExecFn.mockResolvedValue({ close: vi.fn() });
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
                    return Promise.resolve({ close: vi.fn() });
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
                    return Promise.resolve({ close: vi.fn() });
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
