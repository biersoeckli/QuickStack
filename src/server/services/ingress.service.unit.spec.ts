vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        applyResource: vi.fn(),
        customObjects: {
            getNamespacedCustomObject: vi.fn(),
            patchNamespacedCustomObject: vi.fn(),
            createNamespacedCustomObject: vi.fn(),
            deleteNamespacedCustomObject: vi.fn(),
        },
        network: {
            listNamespacedIngress: vi.fn(),
        },
        core: {
            listNamespacedSecret: vi.fn(),
            readNamespacedSecret: vi.fn(),
            createNamespacedSecret: vi.fn(),
        },
    },
}));

vi.mock('@/server/services/namespace.service', () => ({
    default: {
        createNamespaceIfNotExists: vi.fn(),
    },
}));

vi.mock('@/server/services/param.service', () => ({
    default: {
        getOrCreateAgentJwtSecret: vi.fn(async () => 'test-secret-test-secret-test-secret-test'),
    },
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import ingressService from './ingress.service';

function notFound() {
    return Object.assign(new Error('not found'), {
        response: { statusCode: 404 },
    });
}

describe('ingress.service Agent access', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.QS_AGENT_ROUTER_NAMESPACE = 'quickstack';
        vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(notFound());
        vi.mocked(k3s.core.readNamespacedSecret).mockRejectedValue(notFound());
    });

    it('creates sandbox router service and deployment', async () => {
        await ingressService.ensureSandboxRouter();

        expect(k3s.applyResource).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'Service', metadata: expect.objectContaining({ name: 'sandbox-router-svc' }) }),
            'quickstack',
        );
        expect(k3s.applyResource).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'Deployment', metadata: expect.objectContaining({ name: 'sandbox-router-deployment' }) }),
            'quickstack',
        );
    });

    it('creates per-agent middleware and ingressroute', async () => {
        await ingressService.ensureAgentIngress({
            id: 'agent-1',
            projectId: 'proj-1',
        } as any, {
            id: 'domain-1',
            agentId: 'agent-1',
            hostname: 'agent.example.com',
            useSsl: true,
            redirectHttps: true,
        } as any);

        const createdResources = vi.mocked(k3s.customObjects.createNamespacedCustomObject).mock.calls.map((call) => call[4]);
        expect(createdResources).toContainEqual(expect.objectContaining({
            kind: 'Middleware',
            spec: expect.objectContaining({
                forwardAuth: expect.objectContaining({
                    address: 'http://qs-auth-proxy.quickstack.svc.cluster.local:3000/',
                    authResponseHeaders: expect.arrayContaining(['X-Sandbox-ID', 'X-Sandbox-Namespace', 'X-Sandbox-Port']),
                }),
            }),
        }));
        expect(createdResources).toContainEqual(expect.objectContaining({
            kind: 'IngressRoute',
            spec: expect.objectContaining({
                routes: expect.arrayContaining([
                    expect.objectContaining({
                        match: 'Host(`agent.example.com`)',
                    }),
                ]),
            }),
        }));
        expect(k3s.applyResource).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'Deployment', metadata: expect.objectContaining({ name: 'qs-auth-proxy' }) }),
            'quickstack',
        );
    });
});
