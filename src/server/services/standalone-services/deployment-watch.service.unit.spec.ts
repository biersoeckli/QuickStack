const k8sMocks = vi.hoisted(() => {
    const abort = vi.fn();
    const watch = vi.fn().mockResolvedValue({ abort });
    return { watch, abort };
});

vi.mock('@kubernetes/client-node', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@kubernetes/client-node')>();
    class WatchMock {
        watch = k8sMocks.watch;
    }
    return {
        ...actual,
        Watch: WatchMock,
    };
});

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        getKubeConfig: vi.fn(() => ({})),
    },
}));

import deploymentWatchService from '@/server/services/standalone-services/deployment-watch.service';

const flushPromises = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
};

const getEventHandler = () => k8sMocks.watch.mock.calls[0][2] as (type: string, deployment: unknown) => void;
const getDoneHandler = () => k8sMocks.watch.mock.calls[0][3] as (err: unknown) => void;

describe('DeploymentWatchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        k8sMocks.watch.mockResolvedValue({ abort: k8sMocks.abort });

        const service = deploymentWatchService as any;
        service.isWatchRunning = false;
        service.watchRequest = null;
        service.watchGeneration = 0;
        service.subscribers.clear();
        if (service.restartTimeout) {
            clearTimeout(service.restartTimeout);
            service.restartTimeout = null;
        }
    });

    it('starts exactly one watch for multiple subscribers and fans out events', async () => {
        const listenerA = vi.fn();
        const listenerB = vi.fn();

        const unsubscribeA = deploymentWatchService.subscribe(listenerA);
        const unsubscribeB = deploymentWatchService.subscribe(listenerB);
        await flushPromises();

        expect(k8sMocks.watch).toHaveBeenCalledTimes(1);
        expect(k8sMocks.watch.mock.calls[0][0]).toBe('/apis/apps/v1/deployments');

        const deployment = { metadata: { name: 'app-1', namespace: 'proj-1' } };
        getEventHandler()('MODIFIED', deployment);

        expect(listenerA).toHaveBeenCalledWith('MODIFIED', deployment);
        expect(listenerB).toHaveBeenCalledWith('MODIFIED', deployment);

        unsubscribeA();
        unsubscribeB();
    });

    it('isolates a throwing subscriber from the watch and other subscribers', async () => {
        const badListener = vi.fn(() => {
            throw new Error('boom');
        });
        const goodListener = vi.fn(() => Promise.reject(new Error('async boom')));

        deploymentWatchService.subscribe(badListener);
        deploymentWatchService.subscribe(goodListener);
        await flushPromises();

        const deployment = { metadata: { name: 'app-1', namespace: 'proj-1' } };
        expect(() => getEventHandler()('ADDED', deployment)).not.toThrow();
        expect(badListener).toHaveBeenCalledTimes(1);
        expect(goodListener).toHaveBeenCalledTimes(1);
    });

    it('aborts the watch when the last subscriber unsubscribes and restarts on a new subscriber', async () => {
        const unsubscribeA = deploymentWatchService.subscribe(vi.fn());
        await flushPromises();

        unsubscribeA();
        expect(k8sMocks.abort).toHaveBeenCalledTimes(1);
        expect((deploymentWatchService as any).watchRequest).toBeNull();

        deploymentWatchService.subscribe(vi.fn());
        await flushPromises();
        expect(k8sMocks.watch).toHaveBeenCalledTimes(2);
    });

    it('does not abort the shared watch while subscribers remain', async () => {
        const unsubscribeA = deploymentWatchService.subscribe(vi.fn());
        const unsubscribeB = deploymentWatchService.subscribe(vi.fn());
        await flushPromises();

        unsubscribeA();
        expect(k8sMocks.abort).not.toHaveBeenCalled();

        unsubscribeB();
        expect(k8sMocks.abort).toHaveBeenCalledTimes(1);
    });

    it('restarts the watch after an error while subscribers exist', async () => {
        vi.useFakeTimers();
        try {
            const unsubscribe = deploymentWatchService.subscribe(vi.fn());
            await vi.advanceTimersByTimeAsync(0);
            expect(k8sMocks.watch).toHaveBeenCalledTimes(1);

            getDoneHandler()(new Error('watch failed'));
            expect((deploymentWatchService as any).isWatchRunning).toBe(false);

            await vi.advanceTimersByTimeAsync(5000);
            expect(k8sMocks.watch).toHaveBeenCalledTimes(2);

            unsubscribe();
        } finally {
            vi.useRealTimers();
        }
    });
});
