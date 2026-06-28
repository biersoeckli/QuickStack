import { revalidateTag, unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Agent, AgentVolume } from "@prisma/client";
import { AgentExtendedWriteModel, AgentExtendedModel } from "@/shared/model/agent-extended.model";
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
import { AgentConfigModel } from "@/shared/model/agent-config.model";
import { Constants } from "@/shared/utils/constants";
import { AgentSanboxTemplateInfo } from "@/shared/model/agent-sandbox-template-info.model";
import { KubernetesResource } from "@/shared/model/base-kubernetes-object";
import secretService from "./secret.service";
import ingressService from "./ingress.service";
import pvcService from "./pvc.service";
import configMapService from "./config-map.service";
import agentDomainService from "./agent-domain.service";
import agentVolumeService from "./agent-volume.service";
import agentFileMountService from "./agent-file-mount.service";
import { V1Volume, V1VolumeMount } from "@kubernetes/client-node";
import {
    parseStoredContainerCommandArray,
    serializeContainerCommandItems,
} from "@/shared/utils/container-command-args.utils";

const OPENCODE_WORKDIR = '/workspace';
const OPENCODE_WEB_PORT = 4096;
const FILEBROWSER_PORT = 80;
const FILEBROWSER_BASE_URL = '/files';
const OPENCODE_PROVIDER_ID = 'quickstack-litellm';
const DEFAULT_AGENT_IMAGE = 'ghcr.io/anomalyco/opencode:latest';

type AgentSandboxTemplateConfig = {
    id: string;
    projectId: string;
    containerImageSource: string;
    modelAlias: string;
    llmGateway?: { baseUrl: string } | null;
    cpuRequest?: number | null;
    cpuLimit?: number | null;
    memoryRequest?: number | null;
    memoryLimit?: number | null;
    containerCommand?: string | null;
    containerArgs?: string | null;
    volumePvcData: {
        volume: V1Volume;
        volumeMount: V1VolumeMount;
    }[];
    fileVolumes: V1Volume[];
    fileVolumeMounts: V1VolumeMount[];
};

class AgentService {

    async getAllByProjectId(projectId: string): Promise<AgentExtendedModel[]> {
        return await unstable_cache(
            async (pid: string) => dataAccess.client.agent.findMany({
                where: { projectId: pid },
                include: {
                    project: true,
                    llmGateway: true,
                    agentDomains: true,
                    agentVolumes: true,
                    agentFileMounts: true,
                    agentGitSshKey: true,
                },
                orderBy: { name: 'asc' },
            }),
            [Tags.agents(projectId)],
            { tags: [Tags.agents(projectId)] },
        )(projectId);
    }

    async getById(agentId: string, tx?: Prisma.TransactionClient): Promise<AgentExtendedModel> {
        if (tx) {
            return await tx.agent.findFirstOrThrow({
                where: { id: agentId },
                include: {
                    project: true,
                    llmGateway: true,
                    agentDomains: true,
                    agentVolumes: true,
                    agentFileMounts: true,
                    agentGitSshKey: true,
                },
            });
        }
        return await unstable_cache(
            async (id: string) => dataAccess.client.agent.findFirstOrThrow({
                where: { id },
                include: {
                    project: true,
                    llmGateway: true,
                    agentDomains: true,
                    agentVolumes: true,
                    agentFileMounts: true,
                    agentGitSshKey: true,
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
     * Upserts an Agent along with its sub-resources (domains, volumes, file mounts)
     * in a single transaction. Delegates per-item save logic to the respective
     * sub-services ({@link agentDomainService}, {@link agentVolumeService},
     * {@link agentFileMountService}).
     *
     * - If {@link AgentExtendedWriteModel.id} is provided and the agent exists → update.
     * - If the id is provided but no agent exists → create with that id.
     * - If the id is absent → create with a generated id.
     *
     * When called inside an existing transaction pass the `tx`; cache revalidation
     * is deferred to the caller.  When called standalone (no `tx`) the method wraps
     * everything in a new `$transaction` and revalidates caches itself.
     */
    async saveAgentExtendedModel(
        agent: AgentExtendedWriteModel,
        tx?: Prisma.TransactionClient,
    ): Promise<AgentExtendedModel> {
        const run = async (tx: Prisma.TransactionClient) => {
            let savedAgentId: string;

            if (agent.id) {
                const existing = await tx.agent.findUnique({ where: { id: agent.id } });
                if (existing) {
                    await tx.agent.update({
                        where: { id: agent.id },
                        data: {
                            name: agent.name,
                            projectId: agent.projectId,
                            llmGatewayId: agent.llmGatewayId,
                            modelAlias: agent.modelAlias,
                            sourceType: agent.sourceType,
                            buildMethod: agent.buildMethod,
                            containerImageSource: agent.containerImageSource ?? null,
                            containerRegistryUsername: agent.containerRegistryUsername ?? null,
                            containerRegistryPassword: agent.containerRegistryPassword ?? null,
                            gitUrl: agent.gitUrl ?? null,
                            gitBranch: agent.gitBranch ?? null,
                            gitUsername: agent.gitUsername ?? null,
                            gitToken: agent.gitToken ?? null,
                            dockerfilePath: agent.dockerfilePath,
                            cpuRequest: agent.cpuRequest ?? null,
                            cpuLimit: agent.cpuLimit ?? null,
                            memoryRequest: agent.memoryRequest ?? null,
                            memoryLimit: agent.memoryLimit ?? null,
                            systemPrompt: agent.systemPrompt ?? null,
                            encryptedEnvVars: agent.encryptedEnvVars ?? null,
                            containerCommand: agent.containerCommand ?? null,
                            containerArgs: agent.containerArgs ?? null,
                            warmPoolReplicas: agent.warmPoolReplicas,
                        },
                    });
                } else {
                    await tx.agent.create({
                        data: {
                            id: agent.id,
                            name: agent.name,
                            projectId: agent.projectId,
                            llmGatewayId: agent.llmGatewayId,
                            modelAlias: agent.modelAlias,
                            sourceType: agent.sourceType,
                            buildMethod: agent.buildMethod,
                            containerImageSource: agent.containerImageSource ?? null,
                            containerRegistryUsername: agent.containerRegistryUsername ?? null,
                            containerRegistryPassword: agent.containerRegistryPassword ?? null,
                            gitUrl: agent.gitUrl ?? null,
                            gitBranch: agent.gitBranch ?? null,
                            gitUsername: agent.gitUsername ?? null,
                            gitToken: agent.gitToken ?? null,
                            dockerfilePath: agent.dockerfilePath,
                            cpuRequest: agent.cpuRequest ?? null,
                            cpuLimit: agent.cpuLimit ?? null,
                            memoryRequest: agent.memoryRequest ?? null,
                            memoryLimit: agent.memoryLimit ?? null,
                            systemPrompt: agent.systemPrompt ?? null,
                            encryptedEnvVars: agent.encryptedEnvVars ?? null,
                            containerCommand: agent.containerCommand ?? null,
                            containerArgs: agent.containerArgs ?? null,
                            warmPoolReplicas: agent.warmPoolReplicas,
                        },
                    });
                }
                savedAgentId = agent.id;
            } else {
                const agentId = KubeObjectNameUtils.toAgentId(agent.name);
                await tx.agent.create({
                    data: {
                        id: agentId,
                        name: agent.name,
                        projectId: agent.projectId,
                        llmGatewayId: agent.llmGatewayId,
                        modelAlias: agent.modelAlias,
                        sourceType: agent.sourceType,
                        buildMethod: agent.buildMethod,
                        containerImageSource: agent.containerImageSource ?? null,
                        containerRegistryUsername: agent.containerRegistryUsername ?? null,
                        containerRegistryPassword: agent.containerRegistryPassword ?? null,
                        gitUrl: agent.gitUrl ?? null,
                        gitBranch: agent.gitBranch ?? null,
                        gitUsername: agent.gitUsername ?? null,
                        gitToken: agent.gitToken ?? null,
                        dockerfilePath: agent.dockerfilePath,
                        cpuRequest: agent.cpuRequest ?? null,
                        cpuLimit: agent.cpuLimit ?? null,
                        memoryRequest: agent.memoryRequest ?? null,
                        memoryLimit: agent.memoryLimit ?? null,
                        systemPrompt: agent.systemPrompt ?? null,
                        encryptedEnvVars: agent.encryptedEnvVars ?? null,
                        containerCommand: agent.containerCommand ?? null,
                        containerArgs: agent.containerArgs ?? null,
                        warmPoolReplicas: agent.warmPoolReplicas,
                    },
                });
                savedAgentId = agentId;
            }

            // Sub-resources via dedicated sub-services
            for (const domain of agent.agentDomains) {
                await agentDomainService.saveDomain({
                    id: domain.id,
                    hostname: domain.hostname,
                    port: domain.port,
                    useSsl: domain.useSsl,
                    redirectHttps: domain.redirectHttps,
                    agentId: savedAgentId,
                }, tx);
            }
            // Delete sub-items that are no longer in the incoming model
            {
                const existingDomains = await tx.agentDomain.findMany({ where: { agentId: savedAgentId } });
                const keepIds = new Set(agent.agentDomains.map((d) => d.id).filter(Boolean) as string[]);
                for (const existing of existingDomains) {
                    if (!keepIds.has(existing.id)) {
                        await agentDomainService.deleteDomain(existing.id, tx);
                    }
                }
            }

            for (const volume of agent.agentVolumes) {
                await agentVolumeService.saveVolume({
                    id: volume.id,
                    containerMountPath: volume.containerMountPath,
                    size: volume.size,
                    storageClassName: volume.storageClassName as "longhorn",
                    agentId: savedAgentId,
                }, tx);
            }
            // Delete volumes that are no longer in the incoming model
            {
                const existingVolumes = await tx.agentVolume.findMany({ where: { agentId: savedAgentId } });
                const keepIds = new Set(agent.agentVolumes.map((v) => v.id).filter(Boolean) as string[]);
                for (const existing of existingVolumes) {
                    if (!keepIds.has(existing.id)) {
                        await agentVolumeService.deleteVolume(existing.id, tx);
                    }
                }
            }

            for (const fileMount of agent.agentFileMounts) {
                await agentFileMountService.saveFileMount({
                    id: fileMount.id,
                    containerMountPath: fileMount.containerMountPath,
                    content: fileMount.content,
                    agentId: savedAgentId,
                }, tx);
            }
            // Delete file mounts that are no longer in the incoming model
            {
                const existingFileMounts = await tx.agentFileMount.findMany({ where: { agentId: savedAgentId } });
                const keepIds = new Set(agent.agentFileMounts.map((f) => f.id).filter(Boolean) as string[]);
                for (const existing of existingFileMounts) {
                    if (!keepIds.has(existing.id)) {
                        await agentFileMountService.deleteFileMount(existing.id, tx);
                    }
                }
            }

            return await this.getById(savedAgentId, tx);
        };

        if (tx) {
            return await run(tx);
        }

        const result = await dataAccess.client.$transaction(async (innerTx) => {
            return await run(innerTx);
        });

        revalidateTag(Tags.agent(result.id));
        revalidateTag(Tags.agents(result.projectId));
        return result;
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
    async saveConfig(agentId: string, config: Partial<AgentConfigModel>): Promise<Agent> {
        // Read agent for K8s runtime check
        const existing = await this.getById(agentId);

        const isRunning = await agentSandboxAdapter.hasActiveClaim(
            existing.id,
            existing.project.id,
        );

        // Compute diffs and validate before transaction
        const configFields: string[] = [];
        if (config.sourceType !== undefined && config.sourceType !== existing.sourceType) {
            configFields.push('sourceType');
        }
        if (config.buildMethod !== undefined && config.buildMethod !== existing.buildMethod) {
            configFields.push('buildMethod');
        }
        if (config.containerImageSource !== undefined && config.containerImageSource !== existing.containerImageSource) {
            configFields.push('containerImageSource');
        }
        if (config.containerRegistryUsername !== undefined && config.containerRegistryUsername !== existing.containerRegistryUsername) {
            configFields.push('containerRegistryUsername');
        }
        if (config.containerRegistryPassword !== undefined && config.containerRegistryPassword !== existing.containerRegistryPassword) {
            configFields.push('containerRegistryPassword');
        }
        if (config.gitUrl !== undefined && config.gitUrl !== existing.gitUrl) {
            configFields.push('gitUrl');
        }
        if (config.gitBranch !== undefined && config.gitBranch !== existing.gitBranch) {
            configFields.push('gitBranch');
        }
        if (config.gitUsername !== undefined && config.gitUsername !== existing.gitUsername) {
            configFields.push('gitUsername');
        }
        if (config.gitToken !== undefined && config.gitToken !== existing.gitToken) {
            configFields.push('gitToken');
        }
        if (config.dockerfilePath !== undefined && config.dockerfilePath !== existing.dockerfilePath) {
            configFields.push('dockerfilePath');
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
        if (config.containerCommand !== undefined) {
            const nextContainerCommand = serializeContainerCommandItems(config.containerCommand);
            if (nextContainerCommand !== existing.containerCommand) {
                configFields.push('containerCommand');
            }
        }
        if (config.containerArgs !== undefined) {
            const nextContainerArgs = config.containerArgs.length > 0
                ? JSON.stringify(config.containerArgs.map(arg => arg.value))
                : null;
            if (nextContainerArgs !== existing.containerArgs) {
                configFields.push('containerArgs');
            }
        }
        if (config.warmPoolReplicas !== undefined && config.warmPoolReplicas !== existing.warmPoolReplicas) {
            configFields.push('warmPoolReplicas');
        }
        if (config.llmGatewayId !== undefined && config.llmGatewayId !== existing.llmGatewayId) {
            configFields.push('llmGatewayId');
        }
        if (config.modelAlias !== undefined && config.modelAlias !== existing.modelAlias) {
            configFields.push('modelAlias');
        }
        const runtimeRelevant = ['sourceType', 'buildMethod', 'containerImageSource', 'containerRegistryUsername', 'containerRegistryPassword', 'gitUrl', 'gitBranch', 'gitUsername', 'gitToken', 'dockerfilePath', 'cpuRequest', 'cpuLimit', 'memoryRequest', 'memoryLimit', 'containerCommand', 'containerArgs', 'warmPoolReplicas', 'llmGatewayId', 'modelAlias'];

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
        const containerCommandValue =
            config.containerCommand !== undefined
                ? serializeContainerCommandItems(config.containerCommand)
                : undefined;
        const containerArgsValue =
            config.containerArgs !== undefined
                ? (config.containerArgs.length > 0
                    ? JSON.stringify(config.containerArgs.map(arg => arg.value))
                    : null)
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
                    ...(config.sourceType !== undefined ? { sourceType: config.sourceType } : {}),
                    ...(config.buildMethod !== undefined ? { buildMethod: config.buildMethod } : {}),
                    ...(config.containerImageSource !== undefined ? { containerImageSource: config.containerImageSource || null } : {}),
                    ...(config.containerRegistryUsername !== undefined ? { containerRegistryUsername: config.containerRegistryUsername || null } : {}),
                    ...(config.containerRegistryPassword !== undefined ? { containerRegistryPassword: config.containerRegistryPassword || null } : {}),
                    ...(config.gitUrl !== undefined ? { gitUrl: config.gitUrl || null } : {}),
                    ...(config.gitBranch !== undefined ? { gitBranch: config.gitBranch || null } : {}),
                    ...(config.gitUsername !== undefined ? { gitUsername: config.gitUsername || null } : {}),
                    ...(config.gitToken !== undefined ? { gitToken: config.gitToken || null } : {}),
                    ...(config.dockerfilePath !== undefined ? { dockerfilePath: config.dockerfilePath || './Dockerfile' } : {}),
                    ...(config.cpuRequest !== undefined ? { cpuRequest: config.cpuRequest ?? null } : {}),
                    ...(config.cpuLimit !== undefined ? { cpuLimit: config.cpuLimit ?? null } : {}),
                    ...(config.memoryRequest !== undefined ? { memoryRequest: config.memoryRequest ?? null } : {}),
                    ...(config.memoryLimit !== undefined ? { memoryLimit: config.memoryLimit ?? null } : {}),
                    ...(systemPromptValue !== undefined ? { systemPrompt: systemPromptValue } : {}),
                    ...(containerCommandValue !== undefined ? { containerCommand: containerCommandValue } : {}),
                    ...(containerArgsValue !== undefined ? { containerArgs: containerArgsValue } : {}),
                    ...(config.warmPoolReplicas !== undefined ? { warmPoolReplicas: config.warmPoolReplicas } : {}),
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
        if (agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH') {
            throw new ServiceException('Git sources for Agents are saved but cannot be deployed yet. Use a container image source or wait for Agent build support.');
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
                containerImageSource: agent.containerImageSource ?? DEFAULT_AGENT_IMAGE,
                modelAlias: agent.modelAlias,
                llmGateway: agent.llmGateway,
                cpuRequest: agent.cpuRequest ?? null,
                cpuLimit: agent.cpuLimit ?? null,
                memoryRequest: agent.memoryRequest ?? null,
                memoryLimit: agent.memoryLimit ?? null,
                containerCommand: agent.containerCommand ?? null,
                containerArgs: agent.containerArgs ?? null,
                volumePvcData,
                fileVolumes,
                fileVolumeMounts,
            }));

            await agentSandboxAdapter.reconcileSandboxWarmPool(
                this.buildSandboxWarmPoolResource(agent.id, agent.project.id, agent.warmPoolReplicas),
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
        const effectiveImage = agent.containerImageSource;
        const secretName = KubeObjectNameUtils.toSecretId(agent.id);
        const customCommand = parseStoredContainerCommandArray(agent.containerCommand);
        const customArgs = agent.containerArgs ? JSON.parse(agent.containerArgs) : null;
        const usesDefaultOpenCodeStartup = !agent.containerCommand && !customArgs;

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
                            ...(usesDefaultOpenCodeStartup
                                ? {
                                    command: ['/bin/sh', '-lc'],
                                    args: [`cd ${OPENCODE_WORKDIR} && exec opencode web --hostname 0.0.0.0 --port ${OPENCODE_WEB_PORT}`],
                                }
                                : {
                                    ...(customCommand ? { command: customCommand } : {}),
                                    ...(customArgs ? { args: customArgs } : {}),
                                }),
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
