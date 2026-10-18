vi.mock('../adapter/agent-sandbox.adapter', () => ({
    default: {
        getSandbox: vi.fn(),
        getSandboxClaim: vi.fn(),
    },
}));
vi.mock('../adapter/kubernetes-api.adapter', () => ({
    default: { core: { listNamespacedPod: vi.fn() } },
}));

import agentSandboxAdapter from '../adapter/agent-sandbox.adapter';
import k3s from '../adapter/kubernetes-api.adapter';
import agentSandboxResolutionService from './agent-sandbox-resolution.service';

const agent = {
    id: 'agent-1',
    projectId: 'project-1',
    agentVolumes: [],
};

describe('AgentSandboxResolutionService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('resolves a claim-backed Agent Sandbox and its runnable Pod', async () => {
        vi.mocked(agentSandboxAdapter.getSandboxClaim).mockResolvedValue({
            metadata: { labels: { 'qs-agent-id': agent.id }, creationTimestamp: '2026-10-11T00:00:00Z' },
            status: { sandbox: { name: 'runtime-1' }, conditions: [{ type: 'Ready', status: 'True' }] },
        } as any);
        vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue({
            status: { selector: 'sandbox=runtime-1' },
        } as any);
        vi.mocked(k3s.core.listNamespacedPod).mockResolvedValue({
            items: [{ metadata: { name: 'pod-1' }, spec: { containers: [{ name: 'agent' }] }, status: { phase: 'Running' } }],
        } as any);

        await expect(agentSandboxResolutionService.resolveWithPod(agent, 'claim-1')).resolves.toMatchObject({
            sandboxObjectName: 'runtime-1',
            status: 'DEPLOYED',
            podName: 'pod-1',
            containerName: 'agent',
        });
    });

    it('resolves a suspended direct Agent Sandbox without looking up a Pod', async () => {
        vi.mocked(agentSandboxAdapter.getSandbox).mockResolvedValue({
            metadata: {
                labels: { 'qs-agent-id': agent.id },
                annotations: { 'qs-custom-tag': 'workspace-a' },
            },
            spec: { operatingMode: 'Suspended' },
        } as any);

        await expect(agentSandboxResolutionService.resolveWithPod({
            ...agent,
            agentVolumes: [{ volumeType: 'PER_CUSTOM_TAG' }],
        }, 'sandbox-1')).resolves.toMatchObject({
            status: 'SUSPENDED',
            podName: '',
            customTag: 'workspace-a',
        });
        expect(k3s.core.listNamespacedPod).not.toHaveBeenCalled();
    });
});
