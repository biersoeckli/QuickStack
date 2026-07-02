vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));

const dbAgentMocks = vi.hoisted(() => ({
    create: vi.fn(),
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
}));

const dbProjectMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

const dbGatewayMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

const sandboxMocks = vi.hoisted(() => ({
    reconcileSandboxTemplate: vi.fn(),
    reconcileSandboxWarmPool: vi.fn(),
    deleteSandboxTemplate: vi.fn(),
    deleteSandboxWarmPool: vi.fn(),
    hasActiveClaim: vi.fn(),
    listSandboxClaims: vi.fn(),
    deleteSandboxClaim: vi.fn(),
    getSandboxClaim: vi.fn(),
    getSandboxTemplate: vi.fn(),
}));

const secretServiceMocks = vi.hoisted(() => ({
    getDecodedSecret: vi.fn(),
    deleteSecretSafe: vi.fn(),
    createOrUpdateAgentDockerPullSecret: vi.fn(),
    deleteUnusedAgentDockerPullSecret: vi.fn(),
}));

const liteLlmMocks = vi.hoisted(() => ({
    createVirtualKey: vi.fn(),
    deleteVirtualKey: vi.fn(),
    listModelAliases: vi.fn(),
}));

const namespaceServiceMocks = vi.hoisted(() => ({
    createNamespaceIfNotExists: vi.fn(),
}));

const agentRuntimeServiceMocks = vi.hoisted(() => ({
    listInstances: vi.fn(),
    stopAllInstances: vi.fn(),
}));

const pvcServiceMocks = vi.hoisted(() => ({
    ensurePvcForUserAgent: vi.fn(),
    deleteUnusedPvcForAgent: vi.fn(),
    deleteAllPvcForAgent: vi.fn(),
}));

const configMapServiceMocks = vi.hoisted(() => ({
    createOrUpdateConfigMapForAgent: vi.fn(),
    deleteUnusedConfigMapsForAgent: vi.fn(),
}));

const ingressServiceMocks = vi.hoisted(() => ({
    listAgentIngress: vi.fn(),
    deleteAgentIngress: vi.fn(),
    createOrUpdateAgentIngress: vi.fn(),
}));

const buildServiceMocks = vi.hoisted(() => ({
    buildAgent: vi.fn(),
    deleteAllBuildsOfAgent: vi.fn(),
}));

const registryServiceMocks = vi.hoisted(() => ({
    createContainerRegistryUrlForAppId: vi.fn((id?: string) => id ? `localhost:30100/${id}:latest` : undefined),
}));

vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            agent: dbAgentMocks,
            project: dbProjectMocks,
            llmGateway: dbGatewayMocks,
            $transaction: vi.fn((fn: any) => fn({
                agent: dbAgentMocks,
                project: dbProjectMocks,
                llmGateway: dbGatewayMocks,
            })),
        },
    },
}));
vi.mock('@/server/adapter/agent-sandbox.adapter', () => ({
    default: sandboxMocks,
    SANDBOX_API_GROUP: 'extensions.agents.x-k8s.io',
    SANDBOX_API_VERSION: 'v1beta1',
}));
vi.mock('@/server/services/secret.service', () => ({
    default: secretServiceMocks,
}));
vi.mock('@/server/adapter/litellm-api.adapter', () => ({
    default: liteLlmMocks,
}));
vi.mock('@/server/utils/crypto.utils', () => ({
    CryptoUtils: {
        encrypt: vi.fn((value: string) => `encrypted:${value}`),
        decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
    },
}));
vi.mock('@/server/services/namespace.service', () => ({
    default: namespaceServiceMocks,
}));
vi.mock('@/server/services/agent-runtime.service', () => ({
    default: agentRuntimeServiceMocks,
}));
vi.mock('@/server/services/pvc.service', () => ({
    default: pvcServiceMocks,
}));
vi.mock('@/server/services/config-map.service', () => ({
    default: configMapServiceMocks,
}));
vi.mock('@/server/services/ingress.service', () => ({
    default: ingressServiceMocks,
}));
vi.mock('@/server/services/build.service', () => ({
    default: buildServiceMocks,
}));
vi.mock('@/server/services/registry.service', () => ({
    default: registryServiceMocks,
}));
vi.mock('@/server/services/deployment-logs.service', () => ({
    default: {
        catchErrosAndLog: vi.fn(async (_deploymentId: string, fn: () => Promise<void>) => fn()),
    },
    dlog: vi.fn(),
}));

import dataAccess from '@/server/adapter/db.client';
import agentSandboxAdapter from '@/server/adapter/agent-sandbox.adapter';
import liteLlmApiAdapter from '@/server/adapter/litellm-api.adapter';
import { CryptoUtils } from '@/server/utils/crypto.utils';
import { ServiceException } from '@/shared/model/service.exception.model';
import secretService from '@/server/services/secret.service';
import namespaceService from '@/server/services/namespace.service';
import agentRuntimeService from '@/server/services/agent-runtime.service';
import pvcService from '@/server/services/pvc.service';
import configMapService from '@/server/services/config-map.service';
import ingressService from '@/server/services/ingress.service';
import buildService from '@/server/services/build.service';
import agentService from './agent.service';

function mockAgent(id: string, name: string, projectId: string = 'proj-test-agent') {
    return {
        id,
        name,
        projectId,
        llmGatewayId: 'gateway-1',
        modelAlias: 'gpt-4o',
        sourceType: 'CONTAINER',
        buildMethod: 'DOCKERFILE',
        containerImageSource: 'custom/opencode:latest',
        containerRegistryUsername: null,
        containerRegistryPassword: null,
        gitUrl: null,
        gitBranch: null,
        gitUsername: null,
        gitToken: null,
        dockerfilePath: './Dockerfile',
        cpuRequest: null,
        cpuLimit: null,
        memoryRequest: null,
        memoryLimit: null,
        systemPrompt: null,
        encryptedEnvVars: null,
        containerCommand: null,
        containerArgs: null,
        warmPoolReplicas: 0,
        agentDomains: [],
        agentVolumes: [],
        agentFileMounts: [],
        agentGitSshKey: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
    };
}

function mockAgentWithRelations(id: string, name: string, projectId: string = 'proj-test-agent', overrides: Record<string, any> = {}) {
    return {
        ...mockAgent(id, name, projectId),
        project: { id: projectId, name: 'Test Project', projectType: 'AGENT' },
        llmGateway: { id: 'gateway-1', name: 'Test Gateway', baseUrl: 'https://litellm.example.com', encryptedAdminKey: 'encrypted:gw-key' },
        ...overrides,
    };
}

const PROJECT_STUB = { id: 'proj-test-agent', name: 'Agent Project', projectType: 'AGENT' };
const GATEWAY_STUB = {
    id: 'gateway-1',
    name: 'Test Gateway',
    baseUrl: 'https://litellm.example.com',
    encryptedAdminKey: 'encrypted:gw-key',
};

function getOpenCodeConfigFromTemplateCall(callIndex = 0) {
    const resource = vi.mocked(agentSandboxAdapter.reconcileSandboxTemplate).mock.calls[callIndex][0] as any;
    const container = resource.spec.podTemplate.spec.containers[0];
    const configEnv = container.env.find((item: { name: string }) => item.name === 'OPENCODE_CONFIG_CONTENT');
    return {
        resource,
        config: JSON.parse(configEnv.value),
    };
}

describe('agent.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(agentSandboxAdapter.reconcileSandboxTemplate).mockResolvedValue(undefined);
        vi.mocked(agentSandboxAdapter.reconcileSandboxWarmPool).mockResolvedValue(undefined);
        vi.mocked(agentSandboxAdapter.hasActiveClaim).mockResolvedValue(false);
        vi.mocked(agentSandboxAdapter.listSandboxClaims).mockResolvedValue([]);
        vi.mocked(namespaceService.createNamespaceIfNotExists).mockResolvedValue(undefined);
        vi.mocked(agentRuntimeService.listInstances).mockResolvedValue([]);
        vi.mocked(agentRuntimeService.stopAllInstances).mockResolvedValue(undefined);
        vi.mocked(pvcService.ensurePvcForUserAgent).mockResolvedValue({ volume: {} as any, volumeMount: {} as any });
        vi.mocked(pvcService.deleteUnusedPvcForAgent).mockResolvedValue(undefined);
        vi.mocked(pvcService.deleteAllPvcForAgent).mockResolvedValue(undefined);
        vi.mocked(configMapService.createOrUpdateConfigMapForAgent).mockResolvedValue({ fileVolumes: [], fileVolumeMounts: [] });
        vi.mocked(configMapService.deleteUnusedConfigMapsForAgent).mockResolvedValue(undefined);
        vi.mocked(ingressService.listAgentIngress).mockResolvedValue([]);
        vi.mocked(ingressService.deleteAgentIngress).mockResolvedValue(undefined);
        vi.mocked(ingressService.createOrUpdateAgentIngress).mockResolvedValue(undefined);
        vi.mocked(secretService.getDecodedSecret).mockResolvedValue(null);
    });

    describe('saveAgent', () => {
        it('creates an agent with a stable Kubernetes-safe id when id is omitted', async () => {
            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.create).mockResolvedValue(agent as any);

            await agentService.saveAgent({
                name: 'My Agent',
                projectId: 'proj-test-agent',
                llmGatewayId: 'gateway-1',
                modelAlias: 'gpt-4o',
            });

            expect(dataAccess.client.agent.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: expect.stringMatching(/^agent-/),
                    name: 'My Agent',
                    projectId: 'proj-test-agent',
                    llmGatewayId: 'gateway-1',
                    modelAlias: 'gpt-4o',
                }),
            });
        });

        it('updates an existing agent when id is provided', async () => {
            const agent = mockAgent('agent-my-agent', 'My Agent');
            vi.mocked(dataAccess.client.agent.update).mockResolvedValue(agent as any);

            await agentService.saveAgent({
                id: 'agent-my-agent',
                name: 'My Agent',
            });

            expect(dataAccess.client.agent.update).toHaveBeenCalledWith({
                where: { id: 'agent-my-agent' },
                data: {
                    id: 'agent-my-agent',
                    name: 'My Agent',
                },
            });
        });
    });

    describe('getAllByProjectId', () => {
        it('returns agents for a project with relations', async () => {
            const agents = [mockAgent('agent-1', 'Agent One'), mockAgent('agent-2', 'Agent Two')];
            vi.mocked(dataAccess.client.agent.findMany).mockResolvedValue(agents);

            const result = await agentService.getAllByProjectId('proj-test-agent');

            expect(result).toEqual(agents);
            expect(dataAccess.client.agent.findMany).toHaveBeenCalledWith({
                where: { projectId: 'proj-test-agent' },
                include: { project: true, llmGateway: true, agentDomains: true, agentVolumes: true, agentFileMounts: true, agentGitSshKey: true },
                orderBy: { name: 'asc' },
            });
        });
    });

    describe('getById', () => {
        it('returns a single agent with relations', async () => {
            const agent = mockAgent('agent-1', 'Agent One');
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(agent);

            const result = await agentService.getById('agent-1');

            expect(result).toEqual(agent);
            expect(dataAccess.client.agent.findFirstOrThrow).toHaveBeenCalledWith({
                where: { id: 'agent-1' },
                include: { project: true, llmGateway: true, agentDomains: true, agentVolumes: true, agentFileMounts: true, agentGitSshKey: true },
            });
        });
    });

    describe('deploy', () => {
        it('reconciles SandboxTemplate for OpenCode Web runtime', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue({
                ...mockAgentWithRelations('agent-1', 'Agent One'),
                containerImageSource: 'custom/opencode:latest',
                cpuRequest: 250,
                cpuLimit: 1000,
                memoryRequest: 512,
                memoryLimit: 1024,
            } as any);

            await agentService.deploy('agent-1');

            const { resource, config } = getOpenCodeConfigFromTemplateCall();

            expect(resource.apiVersion).toBe('extensions.agents.x-k8s.io/v1beta1');
            expect(resource.kind).toBe('SandboxTemplate');
            expect(resource.metadata).toEqual(expect.objectContaining({
                name: 'agent-1',
                namespace: 'proj-test-agent',
            }));
            const container = resource.spec.podTemplate.spec.containers[0];
            expect(container).toEqual(expect.objectContaining({
                name: 'agent',
                image: 'custom/opencode:latest',
                command: ['/bin/sh', '-lc'],
                args: ['cd /workspace && exec opencode web --hostname 0.0.0.0 --port 4096'],
                workingDir: '/workspace',
                ports: [{ name: 'opencode-web', containerPort: 4096, protocol: 'TCP' }],
                envFrom: [{ secretRef: { name: expect.stringContaining('secret-') } }],
            }));
            expect(container.resources).toEqual({
                requests: { cpu: '250m', memory: '512M' },
                limits: { cpu: '1000m', memory: '1024M' },
            });
            const fileBrowserContainer = resource.spec.podTemplate.spec.containers[1];
            expect(fileBrowserContainer).toEqual(expect.objectContaining({
                name: 'filebrowser',
                args: ['--noauth', '--root', '/srv', '--baseurl', '/files', '--port', '80'],
                ports: [{ name: 'filebrowser-web', containerPort: 80, protocol: 'TCP' }],
            }));
            expect(config).toEqual(expect.objectContaining({
                $schema: 'https://opencode.ai/config.json',
                model: 'quickstack-litellm/gpt-4o',
                server: { hostname: '0.0.0.0', port: 4096 },
            }));
            expect(config.provider['quickstack-litellm']).toEqual(expect.objectContaining({
                npm: '@ai-sdk/openai-compatible',
                name: 'QuickStack LiteLLM',
                options: {
                    baseURL: 'https://litellm.example.com/v1',
                    apiKey: '{env:QS_VIRTUAL_KEY}',
                },
                models: {
                    'gpt-4o': { name: 'gpt-4o' },
                },
            }));
        });

        it('does not duplicate /v1 in LiteLLM baseURL', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue({
                ...mockAgentWithRelations('agent-1', 'Agent One', 'proj-test-agent', {
                    llmGateway: { id: 'gateway-1', baseUrl: 'https://litellm.example.com/v1/', encryptedAdminKey: 'encrypted:gw-key' },
                }),
            } as any);

            await agentService.deploy('agent-1');

            const { config } = getOpenCodeConfigFromTemplateCall();
            expect(config.provider['quickstack-litellm'].options.baseURL).toBe('https://litellm.example.com/v1');
        });

        it('rejects deploy when agent not found', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockRejectedValue(new Error('Agent not found'));

            await expect(agentService.deploy('nonexistent')).rejects.toThrow();
        });

        it('schedules a build for Git sources and waits for BuildWatch to deploy', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(mockAgentWithRelations('agent-1', 'Agent One', 'proj-test-agent', {
                sourceType: 'GIT',
                gitUrl: 'https://github.com/acme/agent.git',
                gitBranch: 'main',
                dockerfilePath: './Dockerfile',
            }) as any);
            vi.mocked(buildService.buildAgent).mockResolvedValue(['build-agent-1', 'abc123', 'feat: test', false]);

            await agentService.deploy('agent-1');

            expect(buildService.buildAgent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: 'agent-1' }), false);
            expect(agentSandboxAdapter.reconcileSandboxTemplate).not.toHaveBeenCalled();
        });

        it('rejects deploy when agent has running instances', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(mockAgentWithRelations('agent-1', 'Agent One') as any);
            vi.mocked(agentRuntimeService.listInstances).mockResolvedValue([{ name: 'ac-test', status: 'DEPLOYED', namespace: 'proj-test-agent', createdAt: '2025-01-01' }]);

            await expect(agentService.deploy('agent-1')).rejects.toThrow(
                'Cannot deploy runtime configuration changes while the Agent is running.',
            );
        });

        it('reconciles WarmPool with configured replicas', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(mockAgentWithRelations('agent-1', 'Agent One', 'proj-test-agent', {
                warmPoolReplicas: 2,
            }) as any);

            await agentService.deploy('agent-1');

            expect(agentSandboxAdapter.reconcileSandboxWarmPool).toHaveBeenCalledWith(
                expect.objectContaining({
                    spec: { sandboxTemplateRef: { name: 'agent-1' }, replicas: 2 },
                }),
            );
        });

        it('uses custom agent container command and args when configured', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(mockAgentWithRelations('agent-1', 'Agent One', 'proj-test-agent', {
                containerCommand: '["sh"]',
                containerArgs: '["-c","echo ready && sleep 3600"]',
            }) as any);

            await agentService.deploy('agent-1');

            const { resource } = getOpenCodeConfigFromTemplateCall();
            const container = resource.spec.podTemplate.spec.containers[0];
            expect(container.command).toEqual(['sh']);
            expect(container.args).toEqual(['-c', 'echo ready && sleep 3600']);
        });

        it('mounts agent file mounts from config maps into the agent container', async () => {
            const agent = mockAgentWithRelations('agent-1', 'Agent One', 'proj-test-agent', {
                agentFileMounts: [{
                    id: 'file-mount-1',
                    agentId: 'agent-1',
                    containerMountPath: '/workspace/config.yaml',
                    content: 'name: test',
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-01'),
                }],
            });
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(agent as any);
            vi.mocked(configMapService.createOrUpdateConfigMapForAgent).mockResolvedValue({
                fileVolumes: [{ name: 'cm-file-mount-1', configMap: { name: 'cm-file-mount-1' } }] as any,
                fileVolumeMounts: [{ name: 'cm-file-mount-1', mountPath: '/workspace/config.yaml', subPath: 'config.yaml', readOnly: true }] as any,
            });

            await agentService.deploy('agent-1');

            expect(configMapService.createOrUpdateConfigMapForAgent).toHaveBeenCalledWith(agent);
            expect(configMapService.deleteUnusedConfigMapsForAgent).toHaveBeenCalledWith(agent);

            const { resource } = getOpenCodeConfigFromTemplateCall();
            expect(resource.spec.podTemplate.spec.volumes).toEqual(expect.arrayContaining([
                { name: 'cm-file-mount-1', configMap: { name: 'cm-file-mount-1' } },
            ]));
            expect(resource.spec.podTemplate.spec.containers[0].volumeMounts).toEqual(expect.arrayContaining([
                { name: 'cm-file-mount-1', mountPath: '/workspace/config.yaml', subPath: 'config.yaml', readOnly: true },
            ]));
            expect(resource.spec.podTemplate.spec.containers[1].volumeMounts).not.toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'cm-file-mount-1' }),
            ]));
        });
    });

    describe('deleteById', () => {
        it('stops runtime, deletes virtual key, sandbox resources, and DB record', async () => {
            const agentMock = mockAgentWithRelations('agent-1', 'Agent One');
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(agentMock as any);
            vi.mocked(dataAccess.client.agent.delete).mockResolvedValue({} as any);
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null); // for $transaction re-read
            vi.mocked(secretService.getDecodedSecret).mockResolvedValue({ QS_VIRTUAL_KEY: 'sk-v-key-123' });
            vi.mocked(liteLlmMocks.deleteVirtualKey).mockResolvedValue(undefined);

            await agentService.deleteById('agent-1');

            expect(secretService.getDecodedSecret).toHaveBeenCalledWith(
                expect.stringContaining('secret-'),
                'proj-test-agent',
            );
            expect(agentRuntimeService.stopAllInstances).toHaveBeenCalledWith('agent-1');
            expect(pvcService.deleteAllPvcForAgent).toHaveBeenCalledWith('proj-test-agent', 'agent-1');
            expect(secretService.deleteSecretSafe).not.toHaveBeenCalled(); // not called in new impl
            expect(liteLlmApiAdapter.deleteVirtualKey).toHaveBeenCalledWith(
                'https://litellm.example.com',
                'gw-key',
                'sk-v-key-123',
            );
            expect(agentSandboxAdapter.deleteSandboxWarmPool).toHaveBeenCalledWith('agent-1', 'proj-test-agent');
            expect(agentSandboxAdapter.deleteSandboxTemplate).toHaveBeenCalledWith('agent-1', 'proj-test-agent');
        });

        it('returns silently when agent getById throws (agent not found)', async () => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockRejectedValue(new Error('Not found'));

            await expect(agentService.deleteById('nonexistent')).resolves.toBeUndefined();
            expect(dataAccess.client.agent.delete).not.toHaveBeenCalled();
        });

        it('preserves DB agent when virtual key cleanup fails', async () => {
            const agentMock = mockAgentWithRelations('agent-1', 'Agent One');
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(agentMock as any);
            vi.mocked(secretService.getDecodedSecret).mockResolvedValue({ QS_VIRTUAL_KEY: 'sk-v-key-123' });
            vi.mocked(liteLlmMocks.deleteVirtualKey).mockRejectedValue(new ServiceException('LiteLLM key deletion failed'));

            await expect(agentService.deleteById('agent-1')).rejects.toThrow('LiteLLM key deletion failed');
            expect(dataAccess.client.agent.delete).not.toHaveBeenCalled();
        });

        it('deletes agent without virtual key when secret is missing', async () => {
            const agentMock = mockAgentWithRelations('agent-1', 'Agent One');
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(agentMock as any);
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);
            vi.mocked(secretService.getDecodedSecret).mockResolvedValue(null);

            await agentService.deleteById('agent-1');

            expect(liteLlmApiAdapter.deleteVirtualKey).not.toHaveBeenCalled();
        });

        it('handles secret read failure gracefully and still deletes', async () => {
            const agentMock = mockAgentWithRelations('agent-1', 'Agent One');
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(agentMock as any);
            vi.mocked(dataAccess.client.agent.findUnique).mockResolvedValue(null);
            vi.mocked(secretService.getDecodedSecret).mockRejectedValue(new Error('K8s API unreachable'));

            await agentService.deleteById('agent-1');

            expect(liteLlmApiAdapter.deleteVirtualKey).not.toHaveBeenCalled();
        });
    });

    describe('saveAgent updates', () => {
        const agentId = 'agent-test-1';
        const existingAgent = mockAgentWithRelations(agentId, 'Test Agent');

        beforeEach(() => {
            vi.mocked(dataAccess.client.agent.findFirstOrThrow).mockResolvedValue(existingAgent as any);
            vi.mocked(dataAccess.client.agent.update).mockResolvedValue({
                ...existingAgent,
                containerImageSource: 'my-custom-image:latest',
                cpuRequest: 200,
                cpuLimit: 1000,
                memoryRequest: 256,
                memoryLimit: 1024,
            } as any);
            vi.mocked(dataAccess.client.agent.findUniqueOrThrow).mockResolvedValue(existingAgent as any);
        });

        it('saves source image, resources, container command, and system prompt config', async () => {
            const result = await agentService.saveAgent({
                id: agentId,
                containerImageSource: 'my-custom-image:latest',
                cpuRequest: 200,
                cpuLimit: 1000,
                memoryRequest: 256,
                memoryLimit: 1024,
                containerCommand: JSON.stringify([{ value: 'sh' }]),
                containerArgs: JSON.stringify([{ value: '-c' }, { value: 'sleep 3600' }].map(arg => arg.value)),
                warmPoolReplicas: 3,
                systemPrompt: 'You are a helpful assistant.',
            });

            expect(dataAccess.client.agent.update).toHaveBeenCalledWith({
                where: { id: agentId },
                data: {
                    id: agentId,
                    containerImageSource: 'my-custom-image:latest',
                    cpuRequest: 200,
                    cpuLimit: 1000,
                    memoryRequest: 256,
                    memoryLimit: 1024,
                    containerCommand: '[{"value":"sh"}]',
                    containerArgs: '["-c","sleep 3600"]',
                    warmPoolReplicas: 3,
                    systemPrompt: 'You are a helpful assistant.',
                },
            });
            expect(result.containerImageSource).toBe('my-custom-image:latest');
        });

        it('encrypts encryptedEnvVars values before saving', async () => {
            const { CryptoUtils } = await import('@/server/utils/crypto.utils');

            await agentService.saveAgent({
                id: agentId,
                encryptedEnvVars: JSON.stringify([
                    { name: 'API_KEY', value: 'secret-123' },
                    { name: 'DB_PASSWORD', value: 'db-secret-456' },
                ]),
            });

            expect(CryptoUtils.encrypt).toHaveBeenCalledWith('secret-123');
            expect(CryptoUtils.encrypt).toHaveBeenCalledWith('db-secret-456');

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            const encryptedRaw = (updateCall as any).data.encryptedEnvVars;
            expect(encryptedRaw).toBeDefined();
            const parsed = JSON.parse(encryptedRaw);
            expect(parsed).toHaveLength(2);
            expect(parsed[0].name).toBe('API_KEY');
            expect(parsed[0].value).toBe('encrypted:secret-123');
            expect(parsed[1].name).toBe('DB_PASSWORD');
            expect(parsed[1].value).toBe('encrypted:db-secret-456');
        });

        it('persists gateway and model alias changes', async () => {
            await agentService.saveAgent({
                id: agentId,
                llmGatewayId: 'new-gateway',
                modelAlias: 'new-model',
            });

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            expect((updateCall as any).data.llmGatewayId).toBe('new-gateway');
            expect((updateCall as any).data.modelAlias).toBe('new-model');
        });

        it('saves only provided fields', async () => {
            await agentService.saveAgent({
                id: agentId,
                systemPrompt: 'new prompt',
            });

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            expect(Object.keys((updateCall as any).data)).toEqual(['id', 'systemPrompt']);
        });

        it('does not send encryptedEnvVars when envVars is undefined', async () => {
            await agentService.saveAgent({
                id: agentId,
                containerImageSource: 'new-image:latest',
            });

            const updateCall = vi.mocked(dataAccess.client.agent.update).mock.calls[0][0];
            expect(Object.keys((updateCall as any).data)).not.toContain('encryptedEnvVars');
        });

    });
});
