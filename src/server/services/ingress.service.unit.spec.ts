vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        applyResource: vi.fn(),
        customObjects: {
            listNamespacedCustomObject: vi.fn(),
            getNamespacedCustomObject: vi.fn(),
            patchNamespacedCustomObject: vi.fn(),
            createNamespacedCustomObject: vi.fn(),
            deleteNamespacedCustomObject: vi.fn(),
        },
        network: {
            listNamespacedIngress: vi.fn(),
            createNamespacedIngress: vi.fn(),
            replaceNamespacedIngress: vi.fn(),
            deleteNamespacedIngress: vi.fn(),
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
        code: 404,
    });
}

describe('ingress.service Agent access', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.QS_AGENT_ROUTER_NAMESPACE = 'quickstack';
        vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(notFound());
        vi.mocked(k3s.customObjects.listNamespacedCustomObject).mockResolvedValue({ items: [{ metadata: { name: 'redirect-to-https' } }] } as any);
        vi.mocked(k3s.core.listNamespacedSecret).mockResolvedValue({ items: [] } as any);
        vi.mocked(k3s.core.readNamespacedSecret).mockRejectedValue(notFound());
        vi.mocked(k3s.network.listNamespacedIngress).mockResolvedValue({ items: [] } as any);
    });

    it('creates per-agent ingress with cert-manager TLS', async () => {
        await ingressService.createOrUpdateAgentIngress({
            id: 'agent-1',
            projectId: 'proj-1',
        } as any, {
            id: 'domain-1',
            agentId: 'agent-1',
            hostname: 'agent.example.com',
            useSsl: true,
            redirectHttps: true,
        } as any);

        const ingressArg = vi.mocked(k3s.network.createNamespacedIngress).mock.calls[0][0];
        expect(ingressArg).toEqual(expect.objectContaining({
            namespace: 'quickstack',
            body: expect.objectContaining({
                kind: 'Ingress',
                metadata: expect.objectContaining({
                    name: expect.stringMatching(/^agent-access-/),
                    namespace: 'quickstack',
                    annotations: expect.objectContaining({
                        'qs-agent-id': 'agent-1',
                        'cert-manager.io/cluster-issuer': 'letsencrypt-production',
                        'traefik.ingress.kubernetes.io/router.middlewares': 'kube-system-redirect-to-https@kubernetescrd',
                    }),
                }),
                spec: expect.objectContaining({
                    ingressClassName: 'traefik',
                    tls: expect.arrayContaining([
                        expect.objectContaining({
                            hosts: ['agent.example.com'],
                        }),
                    ]),
                    rules: expect.arrayContaining([
                        expect.objectContaining({
                            host: 'agent.example.com',
                            http: expect.objectContaining({
                                paths: expect.arrayContaining([
                                    expect.objectContaining({
                                        backend: expect.objectContaining({
                                            service: expect.objectContaining({
                                                name: 'qs-auth-proxy',
                                                port: { number: 3000 },
                                            }),
                                        }),
                                    }),
                                ]),
                            }),
                        }),
                    ]),
                }),
            }),
        }));
        expect(k3s.applyResource).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'Deployment', metadata: expect.objectContaining({ name: 'qs-auth-proxy' }) }),
            'quickstack',
        );
    });
});
