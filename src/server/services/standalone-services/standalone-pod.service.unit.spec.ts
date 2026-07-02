const k3sMocks = vi.hoisted(() => ({
    listNamespacedPod: vi.fn(),
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: {
            listNamespacedPod: k3sMocks.listNamespacedPod,
        },
    },
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            project: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        },
    },
}));

import standalonePodService from './standalone-pod.service';

function podItem(name: string, containerName: string, uid?: string, phase?: string) {
    return {
        metadata: { name, uid: uid || `${name}-uid` },
        spec: { containers: [{ name: containerName }] },
        status: { phase: phase || 'Running' },
    };
}

describe('standalonePodService.getPodsForAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns pods matching by name containing agentId', async () => {
        k3sMocks.listNamespacedPod.mockResolvedValue({
            items: [
                podItem('kwaid-agent-1-abc123', 'agent'),
                podItem('other-pod', 'web'),
            ],
        });

        const result = await standalonePodService.getPodsForAgent('project-1', 'kwaid-agent-1');
        expect(result).toHaveLength(1);
        expect(result[0].podName).toBe('kwaid-agent-1-abc123');
        expect(result[0].containerName).toBe('agent');
    });

    it('returns pods matching by container name "agent"', async () => {
        k3sMocks.listNamespacedPod.mockResolvedValue({
            items: [
                podItem('sandbox-pod-1', 'agent'),
                podItem('sandbox-pod-2', 'agent'),
                podItem('unrelated', 'web'),
            ],
        });

        const result = await standalonePodService.getPodsForAgent('project-1', 'different-agent-id');
        expect(result).toHaveLength(2);
        expect(result[0].podName).toBe('sandbox-pod-1');
        expect(result[1].podName).toBe('sandbox-pod-2');
    });

    it('returns empty array when no matching pods exist', async () => {
        k3sMocks.listNamespacedPod.mockResolvedValue({
            items: [
                podItem('web-pod', 'web'),
                podItem('db-pod', 'postgres'),
            ],
        });

        const result = await standalonePodService.getPodsForAgent('project-1', 'nonexistent');
        expect(result).toHaveLength(0);
    });

    it('returns empty array when namespace has no pods', async () => {
        k3sMocks.listNamespacedPod.mockResolvedValue({
            items: [],
        });

        const result = await standalonePodService.getPodsForAgent('project-1', 'agent-1');
        expect(result).toHaveLength(0);
    });

    it('includes uid and status in result', async () => {
        k3sMocks.listNamespacedPod.mockResolvedValue({
            items: [
                podItem('agent-pod-1', 'agent', 'uid-123', 'Running'),
            ],
        });

        const result = await standalonePodService.getPodsForAgent('project-1', 'agent');
        expect(result).toHaveLength(1);
        expect(result[0].uid).toBe('uid-123');
        expect(result[0].status).toBe('Running');
    });
});
