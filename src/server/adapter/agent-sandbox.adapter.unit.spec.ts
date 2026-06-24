vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: {},
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
                apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                kind: 'SandboxTemplate',
                metadata: { name, namespace },
                spec: {
                    podTemplate: {
                        spec: {
                            containers: [{
                                name: 'agent',
                                image: 'example/agent:latest',
                                command: ['node'],
                                args: ['server.js'],
                                env: [{ name: 'NODE_ENV', value: 'production' }],
                                envFrom: [{ secretRef: { name: 'secret-agent-test' } }],
                                ports: [{ name: 'http', containerPort: 4096, protocol: 'TCP' }],
                                workingDir: '/workspace',
                            }],
                        },
                    },
                },
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
                apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                kind: 'SandboxWarmPool',
                metadata: { name, namespace },
                spec: {
                    sandboxTemplateRef: { name: 'agent-template' },
                    replicas: 2,
                },
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

        it('rejects SandboxTemplate with wrong apiVersion', async () => {
            await expect(
                agentSandboxAdapter.reconcileSandboxTemplate({
                    apiVersion: 'wrong.group/v1',
                    kind: 'SandboxTemplate',
                    metadata: { name, namespace },
                    spec: {},
                }),
            ).rejects.toThrow('Invalid apiVersion for sandboxtemplates');
        });

        it('rejects SandboxTemplate with wrong kind', async () => {
            await expect(
                agentSandboxAdapter.reconcileSandboxTemplate({
                    apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                    kind: 'WrongKind',
                    metadata: { name, namespace },
                    spec: {},
                }),
            ).rejects.toThrow('Invalid kind for sandboxtemplates');
        });

        it('rejects SandboxWarmPool with wrong apiVersion', async () => {
            await expect(
                agentSandboxAdapter.reconcileSandboxWarmPool({
                    apiVersion: 'wrong.group/v1',
                    kind: 'SandboxWarmPool',
                    metadata: { name, namespace },
                    spec: {},
                }),
            ).rejects.toThrow('Invalid apiVersion for sandboxwarmpools');
        });

        it('rejects SandboxWarmPool with wrong kind', async () => {
            await expect(
                agentSandboxAdapter.reconcileSandboxWarmPool({
                    apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                    kind: 'WrongKind',
                    metadata: { name, namespace },
                    spec: {},
                }),
            ).rejects.toThrow('Invalid kind for sandboxwarmpools');
        });

        it('rejects SandboxClaim with wrong apiVersion', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await expect(
                agentSandboxAdapter.createSandboxClaim({
                    apiVersion: 'wrong.group/v1',
                    kind: 'SandboxClaim',
                    metadata: { name, namespace },
                    spec: { warmPoolRef: { name: 'agent-test' } },
                }),
            ).rejects.toThrow('Invalid apiVersion for sandboxclaims');
        });

        it('rejects SandboxClaim with wrong kind', async () => {
            vi.mocked(k3s.customObjects.getNamespacedCustomObject).mockRejectedValue(
                Object.assign(new Error('Not Found'), { response: { statusCode: 404 } }),
            );

            await expect(
                agentSandboxAdapter.createSandboxClaim({
                    apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                    kind: 'WrongKind',
                    metadata: { name, namespace },
                    spec: { warmPoolRef: { name: 'agent-test' } },
                }),
            ).rejects.toThrow('Invalid kind for sandboxclaims');
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
                apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                kind: 'SandboxClaim',
                metadata: { name, namespace },
                spec: { warmPoolRef: { name: 'agent-test' } },
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
                agentSandboxAdapter.createSandboxClaim({
                    apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
                    kind: 'SandboxClaim',
                    metadata: { name, namespace },
                    spec: { warmPoolRef: { name: 'agent-test' } },
                }),
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
