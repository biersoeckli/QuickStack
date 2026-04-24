vi.mock('@kubernetes/client-node', async () => {
    const actual = await vi.importActual<typeof import('@kubernetes/client-node')>('@kubernetes/client-node');
    class WatchMock {
        watch = vi.fn().mockResolvedValue({ abort: vi.fn() });
    }
    return {
        ...actual,
        Watch: WatchMock,
    };
});

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        getKubeConfig: vi.fn(),
        core: {
            listNamespacedPod: vi.fn(),
        },
        log: {
            log: vi.fn(),
        },
    },
}));
vi.mock('@/server/services/deployment-logs.service', () => ({
    dlog: vi.fn(),
}));
vi.mock('@/server/services/registry.service', () => ({
    BUILD_NAMESPACE: 'qs-build',
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import { dlog } from '@/server/services/deployment-logs.service';
import buildPodLogWatchService from '@/server/services/standalone-services/build-pod-log-watch.service';
import stream from 'stream';

const flushPromises = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('BuildPodLogWatchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (buildPodLogWatchService as any).processedContainerKeys.clear();
        (buildPodLogWatchService as any).activeContainerKeys.clear();
        (buildPodLogWatchService as any).isWatchRunning = false;
        (buildPodLogWatchService as any).watchRequest = null;
    });

    it('captures logs for readable containers when deployment annotation is present', async () => {
        const pod = {
            metadata: {
                uid: 'pod-uid-1',
                name: 'build-pod-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                },
            },
            spec: {
                initContainers: [{ name: 'build-queue-init' }],
                containers: [{ name: 'build-1' }],
            },
            status: {
                initContainerStatuses: [
                    { name: 'build-queue-init', state: { terminated: { exitCode: 0 } } },
                ],
                containerStatuses: [
                    { name: 'build-1', state: { running: { startedAt: new Date().toISOString() } } },
                ],
            },
        };

        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({ body: { items: [pod] } } as any);
        vi.mocked(k3s.log.log).mockImplementation(async (_ns, _podName, containerName, logStream) => {
            const writable = logStream as stream.PassThrough;
            queueMicrotask(() => {
                writable.emit('data', Buffer.from(`log:${containerName}\n`));
                writable.end();
            });
            return { abort: vi.fn() } as any;
        });

        await buildPodLogWatchService.startWatch();
        await flushPromises();

        expect(vi.mocked(k3s.log.log)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(dlog).mock.calls.map((call) => call[1])).toContain('[INFO] Streaming logs from pod "build-pod-1" container "build-queue-init"');
        expect(vi.mocked(dlog).mock.calls.map((call) => call[1])).toContain('[INFO] Streaming logs from pod "build-pod-1" container "build-1"');
    });

    it('ignores pods without deployment annotation', async () => {
        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({
            body: {
                items: [{
                    metadata: {
                        uid: 'pod-uid-1',
                        name: 'build-pod-1',
                    },
                    spec: {
                        containers: [{ name: 'build-1' }],
                    },
                    status: {
                        containerStatuses: [
                            { name: 'build-1', state: { running: { startedAt: new Date().toISOString() } } },
                        ],
                    },
                }],
            },
        } as any);

        await buildPodLogWatchService.startWatch();
        await flushPromises();

        expect(vi.mocked(k3s.log.log)).not.toHaveBeenCalled();
    });

    it('does not start duplicate streams for the same pod container', async () => {
        const pod = {
            metadata: {
                uid: 'pod-uid-1',
                name: 'build-pod-1',
                annotations: {
                    'qs-deplyoment-id': 'deployment-1',
                },
            },
            spec: {
                containers: [{ name: 'build-1' }],
            },
            status: {
                containerStatuses: [
                    { name: 'build-1', state: { running: { startedAt: new Date().toISOString() } } },
                ],
            },
        };

        let endStream: (() => void) | undefined;
        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({ body: { items: [pod] } } as any);
        vi.mocked(k3s.log.log).mockImplementation(async (_ns, _podName, _containerName, logStream) => {
            const writable = logStream as stream.PassThrough;
            endStream = () => writable.end();
            return { abort: vi.fn() } as any;
        });

        await buildPodLogWatchService.startWatch();
        await (buildPodLogWatchService as any).captureLogsForPod(pod);
        await flushPromises();

        expect(vi.mocked(k3s.log.log)).toHaveBeenCalledTimes(1);
        endStream?.();
        await flushPromises();
    });
});
