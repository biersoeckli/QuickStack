const k3sMocks = vi.hoisted(() => ({
    listNamespacedEvent: vi.fn(),
}));

const podServiceMocks = vi.hoisted(() => ({
    getPodsForAgent: vi.fn(),
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: {
            listNamespacedEvent: k3sMocks.listNamespacedEvent,
        },
    },
}));

vi.mock('@/server/services/pod.service', () => ({
    default: podServiceMocks,
}));

import eventService from './event.service';

function k8sEvent(action: string, reason: string, message: string, type: string, time: Date) {
    return {
        action,
        reason,
        message,
        type,
        eventTime: time,
        lastTimestamp: undefined,
    };
}

function podEventResponse(podName: string, uid: string, events: any[]) {
    return { items: events };
}

describe('eventService.getEventsForAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns pod events for agent pods', async () => {
        podServiceMocks.getPodsForAgent.mockResolvedValue([
            { podName: 'agent-pod-1', containerName: 'agent', uid: 'uid-1', status: 'Running' },
        ]);

        k3sMocks.listNamespacedEvent
            .mockResolvedValueOnce(podEventResponse('agent-pod-1', 'uid-1', [
                k8sEvent('Created', 'Started', 'Container started', 'Normal', new Date('2026-01-01T10:00:00Z')),
                k8sEvent('Pulled', 'Pulled', 'Container image pulled', 'Normal', new Date('2026-01-01T09:00:00Z')),
            ]))
            .mockResolvedValueOnce({ items: [] }); // claim events fallback

        const result = await eventService.getEventsForAgent('project-1', 'agent-1');

        expect(result).toHaveLength(2);
        expect(result[0].podName).toBe('agent-pod-1');
        expect(result[0].reason).toBe('Started');
        // Sorted by time descending
        expect(result[0].eventTime).toEqual(new Date('2026-01-01T10:00:00Z'));
        expect(result[1].eventTime).toEqual(new Date('2026-01-01T09:00:00Z'));
    });

    it('includes SandboxClaim events when available', async () => {
        podServiceMocks.getPodsForAgent.mockResolvedValue([
            { podName: 'agent-pod-1', containerName: 'agent', uid: 'uid-1', status: 'Running' },
        ]);

        k3sMocks.listNamespacedEvent
            .mockResolvedValueOnce(podEventResponse('agent-pod-1', 'uid-1', [
                k8sEvent('Created', 'Started', 'Container started', 'Normal', new Date('2026-01-01T10:00:00Z')),
            ]))
            .mockResolvedValueOnce({
                items: [
                    k8sEvent(
                        'ClaimExpired',
                        'ClaimExpired',
                        'Sandbox claim has expired',
                        'Warning',
                        new Date('2026-01-01T10:05:00Z'),
                    ),
                ],
            });

        const result = await eventService.getEventsForAgent('project-1', 'agent-1');

        expect(result).toHaveLength(2);
        expect(result[0].podName).toBe('SandboxClaim/agent-1');
        expect(result[0].reason).toBe('ClaimExpired');
        expect(result[0].type).toBe('Warning');
        expect(result[1].podName).toBe('agent-pod-1');
    });

    it('handles claim event fetch failure gracefully', async () => {
        podServiceMocks.getPodsForAgent.mockResolvedValue([
            { podName: 'agent-pod-1', containerName: 'agent', uid: 'uid-1', status: 'Running' },
        ]);

        k3sMocks.listNamespacedEvent
            .mockResolvedValueOnce(podEventResponse('agent-pod-1', 'uid-1', [
                k8sEvent('Created', 'Started', 'Container started', 'Normal', new Date('2026-01-01T10:00:00Z')),
            ]))
            .mockRejectedValueOnce(new Error('claim events not available'));

        const result = await eventService.getEventsForAgent('project-1', 'agent-1');

        expect(result).toHaveLength(1);
        expect(result[0].reason).toBe('Started');
    });

    it('returns empty array when no agent pods exist', async () => {
        podServiceMocks.getPodsForAgent.mockResolvedValue([]);
        k3sMocks.listNamespacedEvent.mockResolvedValue({ items: [] });

        const result = await eventService.getEventsForAgent('project-1', 'agent-1');

        expect(result).toHaveLength(0);
    });

    it('sorts events by time descending across pods and claims', async () => {
        podServiceMocks.getPodsForAgent.mockResolvedValue([
            { podName: 'pod-1', containerName: 'agent', uid: 'uid-1', status: 'Running' },
            { podName: 'pod-2', containerName: 'agent', uid: 'uid-2', status: 'Running' },
        ]);

        k3sMocks.listNamespacedEvent
            .mockResolvedValueOnce(podEventResponse('pod-1', 'uid-1', [
                k8sEvent('Created', 'Started', 'pod-1 started', 'Normal', new Date('2026-01-01T10:00:00Z')),
            ]))
            .mockResolvedValueOnce(podEventResponse('pod-2', 'uid-2', [
                k8sEvent('Created', 'Error', 'pod-2 error', 'Warning', new Date('2026-01-01T10:30:00Z')),
            ]))
            .mockResolvedValueOnce({
                items: [
                    k8sEvent(
                        'Scheduled',
                        'Scheduled',
                        'Claim scheduled',
                        'Normal',
                        new Date('2026-01-01T09:00:00Z'),
                    ),
                ],
            });

        const result = await eventService.getEventsForAgent('project-1', 'agent-1');

        expect(result).toHaveLength(3);
        expect(result[0].reason).toBe('Error');
        expect(result[1].reason).toBe('Started');
        expect(result[2].reason).toBe('Scheduled');
    });
});
