import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Agent, AgentVolume } from "@prisma/client";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import agentSandboxAdapter, {
    SANDBOX_API_GROUP,
    SANDBOX_API_VERSION,
} from "../adapter/agent-sandbox.adapter";
import liteLlmApiAdapter from "../adapter/litellm-api.adapter";
import { CryptoUtils } from "../utils/crypto.utils";
import namespaceService from "./namespace.service";
import agentRuntimeService from "./agent-runtime.service";
import { AgentConfigInputModel } from "@/shared/model/agent-config.model";
import { Constants } from "@/shared/utils/constants";
import { AgentSanboxTemplateInfo } from "@/shared/model/agent-sandbox-template-info.model";
import { KubernetesResource } from "@/shared/model/base-kubernetes-object";
import secretService from "./secret.service";
import ingressService from "./ingress.service";
import pvcService from "./pvc.service";
import configMapService from "./config-map.service";
import { V1Volume, V1VolumeMount } from "@kubernetes/client-node";

const OPENCODE_WORKDIR = '/workspace';
const OPENCODE_WEB_PORT = 4096;
const FILEBROWSER_PORT = 80;
const FILEBROWSER_BASE_URL = '/files';
const OPENCODE_PROVIDER_ID = 'quickstack-litellm';

type AgentSandboxTemplateConfig = {
    id: string;
    projectId: string;
    image: string | null;
    modelAlias: string;
    llmGateway?: { baseUrl: string } | null;
    cpuRequest?: number | null;
    cpuLimit?: number | null;
    memoryRequest?: number | null;
    memoryLimit?: number | null;
    volumePvcData: {
        volume: V1Volume;
        volumeMount: V1VolumeMount;
    }[];
    fileVolumes: V1Volume[];
    fileVolumeMounts: V1VolumeMount[];
};

class AgentService {

    async getAllByProjectId(projectId: string): Promise<AgentWithRelationsModel[]> {
        return await unstable_cache(
            async (pid: string) => dataAccess.client.agent.findMany({
                where: { projectId: pid },
                include: {
                    project: true,
                    llmGateway: true,
                    agentDomains: true,
                    agentVolumes: true,
                    agentFileMounts: true,
                },
                orderBy: { name: 'asc' },
            }),
            [Tags.agents(projectId)],
            { tags: [Tags.agents(projectId)] },
        )(projectId);
    }

    async getById(agentId: string): Promise<AgentWithRelationsModel> {
        return await unstable_cache(
            async (id: string) => dataAccess.client.agent.findFirstOrThrow({
                where: { id },
                include: {
                    project: true,
                    llmGateway: true,
                    agentDomains: true,
                    agentVolumes: true,
                    agentFileMounts: true,
                },
            }),
            [Tags.agent(agentId)],
            { tags: [Tags.agent(agentId)] },
        )(agentId);
    }


    async create(input: {
        name: string;
        projectId: string;
        llmGatewayId: string;
        modelAlias: string;
    }): Promise<Agent> {
        try {
            const agentId = KubeObjectNameUtils.toAgentId(input.name);

            // Validate project, gateway and create agent in a single DB transaction
            const createdAgent = await dataAccess.client.$transaction(async (tx) => {
                const project = await tx.project.findUnique({
                    where: { id: input.projectId },
                    select: { projectType: true, id: true },
                });
                if (!project) {
                    throw new ServiceException('Project not found.');
                }
                if (project.projectType !== 'AGENT') {
                    throw new ServiceException('Agents can only be created in Agent Projects.');
                }

                const gateway = await tx.llmGateway.findUnique({
                    where: { id: input.llmGatewayId },
                    select: { id: true },
                });
                if (!gateway) {
                    throw new ServiceException('LLM Gateway not found.');
                }

                return tx.agent.create({
                    data: {
                        id: agentId,
                        name: input.name,
                        projectId: input.projectId,
                        llmGatewayId: input.llmGatewayId,
                        modelAlias: input.modelAlias,
                    },
                });
            });

            // Ensure the project namespace exists in K8s
            await namespaceService.createNamespaceIfNotExists(createdAgent.projectId);

            return createdAgent;
        } finally {
            revalidateTag(Tags.agents(input.projectId));
            revalidateTag(Tags.projects());
        }
    }

    /**
     * Saves runtime configuration to the database only.
     * Does NOT reconcile Kubernetes sandbox resources — use {@link deploy} for that.
     *
     * - Validates K8s resource quantities and env var names.
     * - Encrypts environment variable values via CryptoUtils.
     * - Rejects QuickStack-reserved env var names.
     * - Locks runtime-relevant config while the Agent has an active SandboxClaim (running).
     * - Invalidates stored virtual-key state on gateway/model changes.
     */
    async saveConfig(agentId: string, config: AgentConfigInputModel): Promise<Agent> {
        // Read agent for K8s runtime check
        const existing = await this.getById(agentId);

        const isRunning = await agentSandboxAdapter.hasActiveClaim(
            existing.id,
            existing.project.id,
        );

        // Compute diffs and validate before transaction
        const configFields: string[] = [];
        if (config.image !== undefined && config.image !== existing.image) {
            configFields.push('image');
        }
        if (config.cpuRequest !== undefined && config.cpuRequest !== existing.cpuRequest) {
            configFields.push('cpuRequest');
        }
        if (config.cpuLimit !== undefined && config.cpuLimit !== existing.cpuLimit) {
            configFields.push('cpuLimit');
        }
        if (config.memoryRequest !== undefined && config.memoryRequest !== existing.memoryRequest) {
            configFields.push('memoryRequest');
        }
        if (config.memoryLimit !== undefined && config.memoryLimit !== existing.memoryLimit) {
            configFields.push('memoryLimit');
        }
        if (config.llmGatewayId !== undefined && config.llmGatewayId !== existing.llmGatewayId) {
            configFields.push('llmGatewayId');
        }
        if (config.modelAlias !== undefined && config.modelAlias !== existing.modelAlias) {
            configFields.push('modelAlias');
        }
        const runtimeRelevant = ['image', 'cpuRequest', 'cpuLimit', 'memoryRequest', 'memoryLimit', 'llmGatewayId', 'modelAlias'];

        if (isRunning) {
            const changedRuntime = configFields.some((f) => runtimeRelevant.includes(f));
            if (changedRuntime) {
                throw new ServiceException(
                    'Runtime configuration cannot be changed while the Agent is running. Stop the Agent first.',
                );
            }
        }

        const isGatewayChanged =
            config.llmGatewayId !== undefined && config.llmGatewayId !== existing.llmGatewayId;
        const isModelChanged =
            config.modelAlias !== undefined && config.modelAlias !== existing.modelAlias;

        let encryptedEnvVars: string | null = null;
        if (config.envVars !== undefined) {
            encryptedEnvVars = JSON.stringify(
                config.envVars.map((ev) => ({
                    name: ev.name,
                    value: CryptoUtils.encrypt(ev.value),
                })),
            );
        }

        const systemPromptValue =
            config.systemPrompt !== undefined
                ? (config.systemPrompt || null)
                : undefined;

        // Transactional read-then-write to prevent lost updates
        const updated = await dataAccess.client.$transaction(async (tx) => {
            // Re-read inside transaction to ensure we update the latest row
            const current = await tx.agent.findUniqueOrThrow({
                where: { id: agentId },
            });

            // If gateway was changed, verify no conflicting concurrent change
            if (isGatewayChanged && current.llmGatewayId !== existing.llmGatewayId) {
                throw new ServiceException(
                    'Agent configuration was modified by another process. Please reload and try again.',
                );
            }

            return tx.agent.update({
                where: { id: agentId },
                data: {
                    ...(config.image !== undefined ? { image: config.image || null } : {}),
                    ...(config.cpuRequest !== undefined ? { cpuRequest: config.cpuRequest ?? null } : {}),
                    ...(config.cpuLimit !== undefined ? { cpuLimit: config.cpuLimit ?? null } : {}),
                    ...(config.memoryRequest !== undefined ? { memoryRequest: config.memoryRequest ?? null } : {}),
                    ...(config.memoryLimit !== undefined ? { memoryLimit: config.memoryLimit ?? null } : {}),
                    ...(systemPromptValue !== undefined ? { systemPrompt: systemPromptValue } : {}),
                    ...(config.envVars !== undefined ? { encryptedEnvVars: encryptedEnvVars! } : {}),
                    ...(isGatewayChanged ? { llmGatewayId: config.llmGatewayId! } : {}),
                    ...(isModelChanged ? { modelAlias: config.modelAlias! } : {}),
                },
            });
        });

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(existing.projectId));

        return updated;
    }

    async getSandboxTemplateDeployInfo(agentId: string) {
        return await unstable_cache(
            async (agentId: string) => {
                const agent = await this.getById(agentId);
                const agentTemplate = await agentSandboxAdapter.getSandboxTemplate(agentId, agent.projectId);
                return {
                    lastDeployedAt: agentTemplate?.metadata?.annotations?.[Constants.QS_ANNOTATION_UPDATED_AT] ? new Date(agentTemplate?.metadata?.annotations?.[Constants.QS_ANNOTATION_UPDATED_AT]) : null,
                } as AgentSanboxTemplateInfo;
            },
            [Tags.agent(agentId)],
            { tags: [Tags.agent(agentId)] },
        )(agentId);
    }

    async deploy(agentId: string): Promise<Agent> {
        const agent = await this.getById(agentId);
        if (!agent) {
            throw new ServiceException('Agent not found.');
        }

        await namespaceService.createNamespaceIfNotExists(agent.project.id);

        const hasRunningInstances = await agentRuntimeService.listInstances(agentId).then(instances => instances.length > 0);
        if (hasRunningInstances) {
            throw new ServiceException(
                'Cannot deploy runtime configuration changes while the Agent is running. Stop the Agent first.',
            );
        }

        const volumePvcData: {
            volume: V1Volume;
            volumeMount: V1VolumeMount;
        }[] = [];
        for (const volume of agent.agentVolumes) {
            const volumePvcDataItem = await pvcService.ensurePvcForUserAgent(
                agent.project.id,
                volume,
            );
            volumePvcData.push(volumePvcDataItem);
        }

        await pvcService.deleteUnusedPvcForAgent(
            agent.project.id,
            agent.id,
            agent.agentVolumes,
        );

        const { fileVolumeMounts, fileVolumes } = await configMapService.createOrUpdateConfigMapForAgent(agent);

        try {
            await agentSandboxAdapter.reconcileSandboxTemplate(this.buildSandboxTemplateResource({
                id: agent.id,
                projectId: agent.project.id,
                image: agent.image ?? null,
                modelAlias: agent.modelAlias,
                llmGateway: agent.llmGateway,
                cpuRequest: agent.cpuRequest ?? null,
                cpuLimit: agent.cpuLimit ?? null,
                memoryRequest: agent.memoryRequest ?? null,
                memoryLimit: agent.memoryLimit ?? null,
                volumePvcData,
                fileVolumes,
                fileVolumeMounts,
            }));

            await agentSandboxAdapter.reconcileSandboxWarmPool(
                this.buildSandboxWarmPoolResource(agent.id, agent.project.id, 0),
            );

            // Reconcile agent domain ingresses — clean up orphaned, then ensure current
            const currentHostnames = new Set(agent.agentDomains.map(d => d.hostname));
            const existingRoutes = await ingressService.listAgentIngress(agent.id);
            for (const route of existingRoutes) {
                if (!currentHostnames.has(route.hostname)) {
                    await ingressService.deleteAgentIngress(route.hostname);
                }
            }
            for (const domain of agent.agentDomains) {
                await ingressService.createOrUpdateAgentIngress(agent, domain);
            }
            await configMapService.deleteUnusedConfigMapsForAgent(agent);
        } catch (error: any) {
            console.error(`Failed to deploy sandbox resources for agent ${agentId}:`, error);
            throw new ServiceException(
                `Failed to deploy sandbox resources: ${error?.message || error}`,
            );
        } finally {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
        }

        return await dataAccess.client.agent.findUniqueOrThrow({
            where: { id: agentId },
        });
    }

    /**
     * Deletes an Agent and all associated resources using a safe cleanup order:
     *
     * 1. Extract virtual key from runtime secret if the agent is running.
     * 2. Stop runtime resources (SandboxClaim + runtime Secret) — idempotent.
     * 3. Delete the LiteLLM virtual key via the Gateway API.
     *    If this fails the DB Agent is preserved so cleanup can be retried.
     * 4. Delete SandboxWarmPool and SandboxTemplate from K8s.
     * 5. Delete the DB Agent record in a transaction.
     */
    async deleteById(agentId: string): Promise<void> {
        const existing = await this.getById(agentId).catch(() => null);
        if (!existing) {
            return;
        }

        const namespace = existing.project.id;

        // 1. Extract virtual key from runtime secret before stopping
        let virtualKey: string | null = null;
        try {
            const secretData = await secretService.getDecodedSecret(
                KubeObjectNameUtils.toSecretId(agentId),
                namespace,
            );
            if (secretData?.QS_VIRTUAL_KEY) {
                virtualKey = secretData.QS_VIRTUAL_KEY;
            }
        } catch {
            // Secret not found or inaccessible — key already cleaned up or never existed
        }

        // 2. Stop runtime resources
        await agentRuntimeService.stopAllInstances(agentId);

        // Delete All PVCs associated with the agent
        await pvcService.deleteAllPvcForAgent(existing.projectId, agentId);

        // 3. Delete LiteLLM virtual key if we extracted one
        if (virtualKey && existing.llmGateway?.encryptedAdminKey) {
            try {
                const adminKey = CryptoUtils.decrypt(existing.llmGateway.encryptedAdminKey);
                await liteLlmApiAdapter.deleteVirtualKey(
                    existing.llmGateway.baseUrl,
                    adminKey,
                    virtualKey,
                );
            } catch (error: any) {
                // Preserve DB Agent when virtual key deletion fails — retryable
                revalidateTag(Tags.agents(existing.projectId));
                revalidateTag(Tags.agent(agentId));
                if (error instanceof ServiceException) {
                    throw error;
                }
                throw new ServiceException(
                    `Failed to delete Agent virtual key: ${error?.message || error}`,
                );
            }
        }

        // 4. Delete K8s sandbox resources (best-effort before DB cleanup)
        await agentSandboxAdapter.deleteSandboxWarmPool(agentId, namespace);
        await agentSandboxAdapter.deleteSandboxTemplate(agentId, namespace);
        // 5. Transactional DB delete — re-reads inside tx to prevent TOCTOU races
        await dataAccess.client.$transaction(async (tx) => {
            const current = await tx.agent.findUnique({
                where: { id: agentId },
            });
            if (current) {
                await tx.agent.delete({
                    where: { id: agentId },
                });
            }
        });

        revalidateTag(Tags.agents(existing.projectId));
        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.projects());
    }

    private normalizeLiteLlmBaseUrl(baseUrl: string): string {
        const trimmed = baseUrl.trim().replace(/\/+$/, '');
        if (!trimmed) {
            throw new ServiceException('LLM Gateway base URL is missing for Agent.');
        }
        return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
    }

    private buildOpenCodeConfig(agent: AgentSandboxTemplateConfig) {
        const modelAlias = agent.modelAlias;
        return {
            $schema: 'https://opencode.ai/config.json',
            model: `${OPENCODE_PROVIDER_ID}/${modelAlias}`,
            provider: {
                [OPENCODE_PROVIDER_ID]: {
                    npm: '@ai-sdk/openai-compatible',
                    name: 'QuickStack LiteLLM',
                    options: {
                        baseURL: this.normalizeLiteLlmBaseUrl(agent.llmGateway?.baseUrl || ''),
                        apiKey: '{env:QS_VIRTUAL_KEY}',
                    },
                    models: {
                        [modelAlias]: {
                            name: modelAlias,
                        },
                    },
                },
            },
            server: {
                hostname: '0.0.0.0',
                port: OPENCODE_WEB_PORT,
            },
        };
    }

    private buildSandboxTemplateResource(agent: AgentSandboxTemplateConfig): KubernetesResource {
        const effectiveImage = agent.image || Constants.QS_DEFAULT_AGENT_IMAGE;
        const secretName = KubeObjectNameUtils.toSecretId(agent.id);

        // Use PVC-based volumes when agent has volumes configured; otherwise fallback to emptyDir
        const hasCustomVolumes = agent.volumePvcData.length > 0;
        const workspaceVolumes = hasCustomVolumes
            ? agent.volumePvcData.map(v => v.volume)
            : [{
                name: 'workspace',
                emptyDir: {},
            }];
        const volumes = [...workspaceVolumes, ...agent.fileVolumes];

        const agentWorkspaceVolumeMounts = hasCustomVolumes
            ? agent.volumePvcData.map(v => v.volumeMount)
            : [{
                name: 'workspace',
                mountPath: OPENCODE_WORKDIR,
            }];
        const agentVolumeMounts = [...agentWorkspaceVolumeMounts, ...agent.fileVolumeMounts];

        // Filebrowser mounts all volumes at /srv/<volume-id> if custom volumes, else workspace
        const filebrowserVolumeMounts = hasCustomVolumes
            ? agent.volumePvcData.map(v => ({
                name: v.volume.name,
                mountPath: `/srv/${v.volumeMount.name}`,
            }))
            : [{
                name: 'workspace',
                mountPath: '/srv',
            }];

        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxTemplate',
            metadata: {
                name: agent.id,
                namespace: agent.projectId,
                annotations: {
                    [Constants.QS_ANNOTATION_UPDATED_AT]: `${new Date().toISOString()}`,
                },
            },
            spec: {
                service: true,
                podTemplate: {
                    spec: {
                        volumes,
                        containers: [{
                            name: 'agent',
                            image: effectiveImage,
                            command: ['/bin/sh', '-lc'],
                            args: [`cd ${OPENCODE_WORKDIR} && exec opencode web --hostname 0.0.0.0 --port ${OPENCODE_WEB_PORT}`],
                            workingDir: OPENCODE_WORKDIR,
                            ports: [{
                                name: 'opencode-web',
                                containerPort: OPENCODE_WEB_PORT,
                                protocol: 'TCP',
                            }],
                            volumeMounts: agentVolumeMounts,
                            envFrom: [{ secretRef: { name: secretName } }],
                            env: [{
                                name: 'OPENCODE_CONFIG_CONTENT',
                                value: JSON.stringify(this.buildOpenCodeConfig(agent)),
                            }],
                            resources: {
                                requests: {
                                    cpu: agent.cpuRequest ? `${agent.cpuRequest}m` : undefined,
                                    memory: agent.memoryRequest ? `${agent.memoryRequest}M` : undefined,
                                },
                                limits: {
                                    cpu: agent.cpuLimit ? `${agent.cpuLimit}m` : undefined,
                                    memory: agent.memoryLimit ? `${agent.memoryLimit}M` : undefined,
                                },
                            },
                        }, {
                            name: 'filebrowser',
                            image: 'filebrowser/filebrowser:v2.31.2',
                            imagePullPolicy: 'Always',
                            args: [
                                '--noauth',
                                '--root', '/srv',
                                '--baseurl', FILEBROWSER_BASE_URL,
                                '--port', `${FILEBROWSER_PORT}`,
                            ],
                            ports: [{
                                name: 'filebrowser-web',
                                containerPort: FILEBROWSER_PORT,
                                protocol: 'TCP',
                            }],
                            volumeMounts: filebrowserVolumeMounts,
                        }]
                    }
                }
            }
        };
    }

    private buildSandboxWarmPoolResource(agentId: string, namespace: string, replicas: number): KubernetesResource {
        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxWarmPool',
            metadata: {
                name: agentId,
                namespace,
                annotations: {
                    [Constants.QS_ANNOTATION_UPDATED_AT]: `${new Date().getTime()}`,
                },
            },
            spec: {
                sandboxTemplateRef: {
                    name: agentId,
                },
                replicas,
            },
        };
    }
}

const agentService = new AgentService();
export default agentService;
