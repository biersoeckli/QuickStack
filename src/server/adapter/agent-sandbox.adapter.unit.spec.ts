vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: {
            createNamespacedSecret: vi.fn(),
            replaceNamespacedSecret: vi.fn(),
            readNamespacedSecret: vi.fn(),
            deleteNamespacedSecret: vi.fn(),
        },
        customObjects: {
            getNamespacedCustomObject: vi.fn(),
            createNamespacedCustomObject: vi.fn(),
            patchNamespacedCustomObject: vi.fn(),
            deleteNamespacedCustomObject: vi.fn(),
        },
    },
}));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import agentSandboxAdapter from './agent-sandbox.adapter';
import { ServiceException } from '@/shared/model/service.exception.model';

describe('AgentSandboxAdapter', () => {
    const namespace = 'test-ns';
    const name = 'agent-test';
    const SANDBOX_API_GROUP = 'extensions.agents.x-k8s.io';
    const SANDBOX_API_VERSION = 'v1beta1';
    const CLAIM_PLURAL = 'sandboxclaims';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Sandbox resource reconciliation', () => {
        it('creates an upstream-compatible SandboxTemplate', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await agentSandboxAdapter.reconcileSandboxTemplate({
                name,
                namespace,
                image: 'example/agent:latest',
                command: ['node'],
                args: ['server.js'],
                env: [{ name: 'NODE_ENV', value: 'production' }],
                envFrom: [{ secretRef: { name: 'secret-agent-test' } }],
                ports: [{ name: 'http', containerPort: 4096, protocol: 'TCP' }],
                workingDir: '/workspace',
            });

            expect(k3s.customObjects.createNamespacedCustomObject).toHaveBeenCalledWith(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                'sandboxtemplates',
                expect.objectContaining({
                    apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                    kind: 'SandboxTemplate',
                    spec: {
                        podTemplate: {
                            spec: {
                                containers: [expect.objectContaining({
                                    name: 'agent',
                                    image: 'example/agent:latest',
                                    command: ['node'],
                                    args: ['server.js'],
                                    env: [{ name: 'NODE_ENV', value: 'production' }],
                                    envFrom: [{ secretRef: { name: 'secret-agent-test' } }],
                                    ports: [{ name: 'http', containerPort: 4096, protocol: 'TCP' }],
                                    workingDir: '/workspace',
                                })],
                            },
                        },
                    },
                }),
            );
        });

        it('creates an upstream-compatible SandboxWarmPool', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await agentSandboxAdapter.reconcileSandboxWarmPool({
                name,
                namespace,
                templateName: 'agent-template',
                replicas: 2,
            });

            expect(k3s.customObjects.createNamespacedCustomObject).toHaveBeenCalledWith(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                'sandboxwarmpools',
                expect.objectContaining({
                    spec: {
                        sandboxTemplateRef: { name: 'agent-template' },
                        replicas: 2,
                    },
                }),
            );
        });
    });

    describe('SandboxClaim operations', () => {
        it('returns false only when a SandboxClaim is not found', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await expect(agentSandboxAdapter.hasActiveClaim(name, namespace)).resolves.toBe(false);
        });

        it('surfaces SandboxClaim lookup errors', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                new Error('connection refused'),
            );

            await expect(agentSandboxAdapter.hasActiveClaim(name, namespace))
                .rejects.toThrow('Failed to check SandboxClaim "agent-test": connection refused');
        });

        it('creates a SandboxClaim targeting the given warmPoolName', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await agentSandboxAdapter.createSandboxClaim({
                name,
                namespace,
                warmPoolName: 'agent-test',
            });

            expect(k3s.customObjects.createNamespacedCustomObject).toHaveBeenCalledWith(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                expect.objectContaining({
                    apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                    kind: 'SandboxClaim',
                    metadata: { name, namespace },
                    spec: { warmPoolRef: { name: 'agent-test' } },
                }),
            );
        });

        it('throws when SandboxClaim already exists', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockResolvedValue({} as any);

            await expect(
                agentSandboxAdapter.createSandboxClaim({ name, namespace, warmPoolName: 'agent-test' }),
            ).rejects.toThrow('SandboxClaim "agent-test" already exists');
        });

        it('deletes a SandboxClaim', async () => {
            await agentSandboxAdapter.deleteSandboxClaim(name, namespace);

            expect(k3s.customObjects.deleteNamespacedCustomObject).toHaveBeenCalledWith(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                name,
            );
        });

        it('handles 404 silently on deleteSandboxClaim', async () => {
            vi.mocked(k3s.customObjects.deleteNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await expect(
                agentSandboxAdapter.deleteSandboxClaim(name, namespace),
            ).resolves.toBeUndefined();
        });

        it('retrieves a SandboxClaim', async () => {
            const claimBody = { metadata: { name }, spec: { warmPoolRef: { name: 'agent-test' } } };
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockResolvedValue({ body: claimBody } as any);

            const result = await agentSandboxAdapter.getSandboxClaim(name, namespace);

            expect(result).toEqual(claimBody);
        });

        it('returns null when SandboxClaim not found', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            const result = await agentSandboxAdapter.getSandboxClaim(name, namespace);

            expect(result).toBeNull();
        });
    });

    describe('Secret operations', () => {
        it('creates a new Secret when none exists', async () => {
            vi.mocked(k3s.core.readNamespacedSecret).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await agentSandboxAdapter.createOrReplaceSecret(name, namespace, {
                QS_GATEWAY_URL: 'https://gw.example.com',
                QS_VIRTUAL_KEY: 'sk-v-123',
            });

            expect(k3s.core.createNamespacedSecret).toHaveBeenCalledWith(namespace, expect.objectContaining({
                metadata: { name },
                data: expect.objectContaining({
                    QS_GATEWAY_URL: expect.any(String),
                    QS_VIRTUAL_KEY: expect.any(String),
                }),
            }));
        });

        it('replaces an existing Secret', async () => {
            vi.mocked(k3s.core.readNamespacedSecret).mockResolvedValue({
                body: { metadata: { name, resourceVersion: '42' } },
            } as any);

            await agentSandboxAdapter.createOrReplaceSecret(name, namespace, {
                QS_GATEWAY_URL: 'https://gw.example.com',
            });

            expect(k3s.core.replaceNamespacedSecret).toHaveBeenCalledWith(
                name,
                namespace,
                expect.objectContaining({ metadata: { name, resourceVersion: '42' } }),
            );
            expect(k3s.core.createNamespacedSecret).not.toHaveBeenCalled();
        });

        it('deletes a Secret', async () => {
            await agentSandboxAdapter.deleteSecret(name, namespace);

            expect(k3s.core.deleteNamespacedSecret).toHaveBeenCalledWith(name, namespace);
        });

        it('handles 404 silently on deleteSecret', async () => {
            vi.mocked(k3s.core.deleteNamespacedSecret).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await expect(
                agentSandboxAdapter.deleteSecret(name, namespace),
            ).resolves.toBeUndefined();
        });
    });

    describe('waitForSandboxReady', () => {
        it('resolves when SandboxClaim returns Ready=True', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockResolvedValue({
                body: {
                    status: {
                        conditions: [
                            { type: 'Ready', status: 'True' },
                        ],
                    },
                },
            } as any);

            await expect(
                agentSandboxAdapter.waitForSandboxReady(name, namespace, 5000, 100),
            ).resolves.toBeUndefined();
        });

        it('keeps polling while SandboxClaim is not ready', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject)
                .mockResolvedValueOnce({
                    body: { status: { conditions: [{ type: 'Ready', status: 'False', reason: 'SandboxNotReady' }] } },
                } as any)
                .mockResolvedValueOnce({
                    body: { status: { conditions: [{ type: 'Ready', status: 'True' }] } },
                } as any);

            await expect(
                agentSandboxAdapter.waitForSandboxReady(name, namespace, 5000, 1),
            ).resolves.toBeUndefined();
        });

        it('throws immediately for terminal claim errors', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockResolvedValue({
                body: {
                    status: {
                        conditions: [{
                            type: 'Ready',
                            status: 'False',
                            reason: 'WarmPoolNotFound',
                            message: 'SandboxWarmPool "missing" not found',
                        }],
                    },
                },
            } as any);

            await expect(
                agentSandboxAdapter.waitForSandboxReady(name, namespace, 5000, 1),
            ).rejects.toThrow('SandboxWarmPool "missing" not found');
        });

        it('throws ServiceException after timeout', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockResolvedValue({
                body: { status: { conditions: [] } },
            } as any);

            await expect(
                agentSandboxAdapter.waitForSandboxReady(name, namespace, 200, 50),
            ).rejects.toThrow(ServiceException);
        });

        it('throws if Sandbox claim does not exist after timeout', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await expect(
                agentSandboxAdapter.waitForSandboxReady(name, namespace, 200, 50),
            ).rejects.toThrow('not found while waiting for readiness');
        });
    });
});
