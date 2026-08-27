const k3sMocks = vi.hoisted(() => ({
    listNamespacedNetworkPolicy: vi.fn(),
    createNamespacedNetworkPolicy: vi.fn(),
    replaceNamespacedNetworkPolicy: vi.fn(),
    deleteNamespacedNetworkPolicy: vi.fn(),
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        network: {
            listNamespacedNetworkPolicy: k3sMocks.listNamespacedNetworkPolicy,
            createNamespacedNetworkPolicy: k3sMocks.createNamespacedNetworkPolicy,
            replaceNamespacedNetworkPolicy: k3sMocks.replaceNamespacedNetworkPolicy,
            deleteNamespacedNetworkPolicy: k3sMocks.deleteNamespacedNetworkPolicy,
        },
    },
}));

import networkPolicyService from './network-policy.service';
import { AppExtendedModel } from '@/shared/model/app-extended.model';

describe('network-policy.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        k3sMocks.listNamespacedNetworkPolicy.mockResolvedValue({ items: [] });
    });

    it('allows external ingress to configured App Node Ports', async () => {
        const app = {
            id: 'demo-app',
            projectId: 'demo-project',
            useNetworkPolicy: true,
            ingressNetworkPolicy: 'DENY_ALL',
            egressNetworkPolicy: 'DENY_ALL',
            appNodePorts: [
                {
                    id: 'node-port-1',
                    appId: 'demo-app',
                    port: 300,
                    nodePort: 30080,
                    protocol: 'TCP',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
        } as AppExtendedModel;

        await networkPolicyService.reconcileNetworkPolicy(app);

        expect(k3sMocks.createNamespacedNetworkPolicy).toHaveBeenCalledTimes(1);
        const policy = k3sMocks.createNamespacedNetworkPolicy.mock.calls[0][0].body;
        expect(policy.spec.ingress).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    _from: [{ ipBlock: { cidr: '0.0.0.0/0' } }],
                    ports: [{ protocol: 'TCP', port: 300 }],
                }),
            ])
        );
    });

    it('allows auth proxy ingress from the quickstack namespace to all sandbox ports', () => {
        const policy = networkPolicyService.buildAgentSandboxTemplateNetworkPolicy({
            allowInternetAccess: false,
            rules: [],
        });

        expect(policy?.ingress).toEqual([{
            from: [{
                namespaceSelector: {
                    matchLabels: {
                        'kubernetes.io/metadata.name': 'quickstack',
                    },
                },
                podSelector: {
                    matchLabels: {
                        app: 'qs-auth-proxy',
                    },
                },
            }],
        }]);
    });

    it('selects all sandboxes of an agent by agent ID label', async () => {
        const app = {
            id: 'demo-app',
            projectId: 'app-project',
            useNetworkPolicy: true,
            networkPolicyMode: 'EXTENDED',
            ingressNetworkPolicy: 'DENY_ALL',
            egressNetworkPolicy: 'DENY_ALL',
            appDomains: [],
            appNodePorts: [],
            appNetworkPolicy: {
                allowInternetAccess: false,
                rules: [{
                    id: 'rule-1',
                    appNetworkPolicyId: 'policy-1',
                    type: 'EGRESS',
                    targetAppId: null,
                    targetAgentId: 'agent-1',
                    targetApp: null,
                    targetAgent: { id: 'agent-1', name: 'Agent one', projectId: 'agent-project' },
                    port: 8080,
                    protocol: 'TCP',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }],
            },
        } as unknown as AppExtendedModel;

        await networkPolicyService.reconcileNetworkPolicy(app);

        const policy = k3sMocks.createNamespacedNetworkPolicy.mock.calls[0][0].body;
        expect(policy.spec.egress).toEqual(expect.arrayContaining([expect.objectContaining({
            to: [{
                namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'agent-project' } },
                podSelector: { matchLabels: { 'qs-agent-id': 'agent-1' } },
            }],
            ports: [{ protocol: 'TCP', port: 8080 }],
        })]));
    });
});
