const {
    mockIsAuthorizedReadForAgent,
    mockAgentService,
    mockPodService,
    mockEventService,
    mockAgentRuntimeService,
} = vi.hoisted(() => ({
    mockIsAuthorizedReadForAgent: vi.fn(),
    mockAgentService: {
        getById: vi.fn(),
    },
    mockPodService: {
        getPodsForAgent: vi.fn(),
    },
    mockEventService: {
        getEventsForAgent: vi.fn(),
    },
    mockAgentRuntimeService: {
        startAgent: vi.fn(),
        stopAgent: vi.fn(),
        getAgentStatus: vi.fn(),
        statusTextFor: vi.fn(),
    },
}));

vi.mock('@/server/utils/action-wrapper.utils', () => ({
    simpleAction: vi.fn((fn: () => any) => fn()),
    isAuthorizedReadForAgent: mockIsAuthorizedReadForAgent,
    isAuthorizedWriteForAgent: vi.fn(),
    getAuthUserSession: vi.fn(),
}));

vi.mock('@/server/utils/shared-authorization.utils', () => ({
    ensureDeleteAgentInProject: vi.fn(),
}));

vi.mock('@/server/services/agent-runtime.service', () => ({
    default: mockAgentRuntimeService,
}));

vi.mock('@/server/services/agent.service', () => ({
    default: mockAgentService,
}));

vi.mock('@/server/services/pod.service', () => ({
    default: mockPodService,
}));

vi.mock('@/server/services/event.service', () => ({
    default: mockEventService,
}));

import { getAgentPodForTerminal } from '@/app/project/agent/[agentId]/overview/actions';

function podItem(name: string, containerName: string) {
    return { podName: name, containerName, uid: `${name}-uid`, status: 'Running' };
}

describe('getAgentPodForTerminal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsAuthorizedReadForAgent.mockResolvedValue(undefined);
        mockAgentService.getById.mockResolvedValue({ projectId: 'proj-1' });
    });

    it('returns pod info for running agent', async () => {
        mockAgentService.getById.mockResolvedValue({ projectId: 'proj-1' });
        mockPodService.getPodsForAgent.mockResolvedValue([
            podItem('sandbox-agent-abc', 'agent'),
        ]);

        const result = await getAgentPodForTerminal('agent-1');

        expect(mockIsAuthorizedReadForAgent).toHaveBeenCalledWith('agent-1');
        expect(mockAgentService.getById).toHaveBeenCalledWith('agent-1');
        expect(mockPodService.getPodsForAgent).toHaveBeenCalledWith('proj-1', 'agent-1');
        const data = result as any;
        expect(data.podName).toBe('sandbox-agent-abc');
        expect(data.containerName).toBe('agent');
        expect(data.namespace).toBe('proj-1');
    });

    it('throws when no pods are running', async () => {
        mockAgentService.getById.mockResolvedValue({ projectId: 'proj-1' });
        mockPodService.getPodsForAgent.mockResolvedValue([]);

        await expect(getAgentPodForTerminal('agent-1')).rejects.toThrow('No agent pod running.');
    });

    it('enforces read authorization before fetching pods', async () => {
        mockIsAuthorizedReadForAgent.mockRejectedValue(new Error('Forbidden'));

        await expect(getAgentPodForTerminal('agent-1')).rejects.toThrow('Forbidden');
        expect(mockPodService.getPodsForAgent).not.toHaveBeenCalled();
    });

    it('uses first pod when multiple match', async () => {
        mockAgentService.getById.mockResolvedValue({ projectId: 'proj-1' });
        mockPodService.getPodsForAgent.mockResolvedValue([
            podItem('sandbox-agent-1', 'agent'),
            podItem('sandbox-agent-2', 'agent'),
        ]);

        const result = await getAgentPodForTerminal('agent-1');

        const data = result as any;
        expect(data.podName).toBe('sandbox-agent-1');
    });
});
