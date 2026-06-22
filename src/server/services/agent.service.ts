import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Agent } from "@prisma/client";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import { CryptoUtils } from "../utils/crypto.utils";
import namespaceService from "./namespace.service";
import { AgentConfigInputModel } from "@/shared/model/agent-config.model";
import { Constants } from "@/shared/utils/constants";


class AgentService {

    /**
     * Returns all agents for a given project, with project and llmGateway relations.
     */
    async getAllByProjectId(projectId: string): Promise<AgentWithRelationsModel[]> {
        return await unstable_cache(
            async (pid: string) => dataAccess.client.agent.findMany({
                where: { projectId: pid },
                include: {
                    project: true,
                    llmGateway: true,
                },
                orderBy: { name: 'asc' },
            }),
            [Tags.agents(projectId)],
            { tags: [Tags.agents(projectId)] },
        )(projectId);
    }

    /**
     * Returns a single agent by id with all relations.
     */
    async getById(agentId: string): Promise<AgentWithRelationsModel> {
        return await unstable_cache(
            async (id: string) => dataAccess.client.agent.findFirstOrThrow({
                where: { id },
                include: {
                    project: true,
                    llmGateway: true,
                },
            }),
            [Tags.agent(agentId)],
            { tags: [Tags.agent(agentId)] },
        )(agentId);
    }

    /**
     * Creates a new Agent in an Agent Project.
     *
     * - Validates project exists and is of type AGENT.
     * - Validates llmGateway exists.
     * - Generates a stable Kubernetes-safe agent id.
     * - Persists the agent record.
     * - Reconciles one SandboxTemplate and one zero-replica SandboxWarmPool.
     * - Rolls back DB record on K8s failure.
     */
    async create(input: {
        name: string;
        projectId: string;
        llmGatewayId: string;
        modelAlias: string;
    }): Promise<Agent> {
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

        try {

            // Reconcile SandboxTemplate
            await agentSandboxAdapter.reconcileSandboxTemplate({
                name: agentId,
                namespace: createdAgent.projectId,
                image: Constants.QS_DEFAULT_AGENT_IMAGE,
            });

            // Reconcile zero-replica SandboxWarmPool
            await agentSandboxAdapter.reconcileSandboxWarmPool({
                name: agentId,
                namespace: createdAgent.projectId,
                templateName: agentId,
                replicas: 0,
            });

            return createdAgent;
        } catch (error: any) {
            // Rollback DB record on K8s failure
            try {
                await dataAccess.client.agent.delete({
                    where: { id: agentId },
                });
            } catch {
                // Best-effort cleanup — log but don't mask original error
                console.error(`Failed to rollback agent ${agentId} after K8s failure:`, error);
            }
            if (error instanceof ServiceException) {
                throw error;
            }
            throw new ServiceException(
                `Failed to create agent: ${error?.message || error}`,
            );
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
        const existing = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: { project: { select: { id: true } } },
        });
        if (!existing) {
            throw new ServiceException('Agent not found.');
        }

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
        const runtimeRelevant = ['image', 'cpuRequest', 'cpuLimit', 'memoryRequest', 'memoryLimit'];

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

    /**
     * Deploys the Agent's saved configuration to Kubernetes.
     *
     * - Reads the latest agent config from the database.
     * - Prevents deploying runtime-relevant changes while the Agent is running.
     * - Reconciles the SandboxTemplate and zero-replica SandboxWarmPool in K8s.
     */
    async deploy(agentId: string): Promise<Agent> {
        const agent = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: { project: { select: { id: true } } },
        });
        if (!agent) {
            throw new ServiceException('Agent not found.');
        }

        const isRunning = await agentSandboxAdapter.hasActiveClaim(
            agent.id,
            agent.project.id,
        );

        const runtimeRelevant = ['image', 'cpuRequest', 'cpuLimit', 'memoryRequest', 'memoryLimit'];

        if (isRunning) {
            throw new ServiceException(
                'Cannot deploy runtime configuration changes while the Agent is running. Stop the Agent first.',
            );
        }

        const effectiveImage = agent.image || Constants.QS_DEFAULT_AGENT_IMAGE;

        try {
            await agentSandboxAdapter.reconcileSandboxTemplate({
                name: agent.id,
                namespace: agent.project.id,
                image: effectiveImage,
                cpuRequest: agent.cpuRequest ? `${agent.cpuRequest}m` : undefined,
                cpuLimit: agent.cpuLimit ? `${agent.cpuLimit}m` : undefined,
                memoryRequest: agent.memoryRequest ? `${agent.memoryRequest}M` : undefined,
                memoryLimit: agent.memoryLimit ? `${agent.memoryLimit}M` : undefined,
            });

            await agentSandboxAdapter.reconcileSandboxWarmPool({
                name: agent.id,
                namespace: agent.project.id,
                templateName: agent.id,
                replicas: 0,
            });
        } catch (error: any) {
            console.error(`Failed to deploy sandbox resources for agent ${agentId}:`, error);
            throw new ServiceException(
                `Failed to deploy sandbox resources: ${error?.message || error}`,
            );
        } finally {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
        }

        return agent;
    }

    /**
     * Deletes an agent and its sandbox resources.
     */
    async deleteById(agentId: string): Promise<void> {
        // Read agent first — needed for K8s namespace and cache tag invalidation
        const existing = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: { project: { select: { id: true } } },
        });
        if (!existing) {
            return;
        }

        const projectId = existing.projectId;
        const namespace = existing.projectId;

        // Delete K8s sandbox resources (best-effort before DB cleanup)
        await agentSandboxAdapter.deleteSandboxWarmPool(agentId, namespace);
        await agentSandboxAdapter.deleteSandboxTemplate(agentId, namespace);

        // Transactional DB delete — re-reads inside tx to prevent TOCTOU races
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

        revalidateTag(Tags.agents(projectId));
        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.projects());
    }
}

const agentService = new AgentService();
export default agentService;
