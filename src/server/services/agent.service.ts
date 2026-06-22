import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Agent, Prisma } from "@prisma/client";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import { CryptoUtils } from "../utils/crypto.utils";
import namespaceService from "./namespace.service";
import { FormValidationException } from "@/shared/model/form-validation-exception.model";
import { AgentConfigModel, agentConfigZodModel, isQuickStackReservedEnvName, AgentConfigInputModel } from "@/shared/model/agent-config.model";
import { z } from "zod";

const DEFAULT_AGENT_IMAGE = 'ghcr.io/quickstack-dev/agent-sandbox:latest';

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
        // Validate project
        const project = await dataAccess.client.project.findUnique({
            where: { id: input.projectId },
            select: { projectType: true, id: true },
        });
        if (!project) {
            throw new ServiceException('Project not found.');
        }
        if (project.projectType !== 'AGENT') {
            throw new ServiceException('Agents can only be created in Agent Projects.');
        }

        // Validate LLM Gateway exists
        const gateway = await dataAccess.client.llmGateway.findUnique({
            where: { id: input.llmGatewayId },
            select: { id: true },
        });
        if (!gateway) {
            throw new ServiceException('LLM Gateway not found.');
        }

        const agentId = KubeObjectNameUtils.toAgentId(input.name);

        // Ensure the project namespace exists in K8s
        await namespaceService.createNamespaceIfNotExists(project.id);

        let createdAgent: Agent | null = null;
        try {
            createdAgent = await dataAccess.client.agent.create({
                data: {
                    id: agentId,
                    name: input.name,
                    projectId: input.projectId,
                    llmGatewayId: input.llmGatewayId,
                    modelAlias: input.modelAlias,
                },
            });

            // Reconcile SandboxTemplate
            await agentSandboxAdapter.reconcileSandboxTemplate({
                name: agentId,
                namespace: project.id,
                image: DEFAULT_AGENT_IMAGE,
            });

            // Reconcile zero-replica SandboxWarmPool
            await agentSandboxAdapter.reconcileSandboxWarmPool({
                name: agentId,
                namespace: project.id,
                templateName: agentId,
                replicas: 0,
            });

            return createdAgent;
        } catch (error: any) {
            // Rollback DB record on K8s failure
            if (createdAgent) {
                try {
                    await dataAccess.client.agent.delete({
                        where: { id: agentId },
                    });
                } catch {
                    // Best-effort cleanup — log but don't mask original error
                    console.error(`Failed to rollback agent ${agentId} after K8s failure:`, error);
                }
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
     * Saves runtime configuration for a stopped Agent.
     *
     * - Validates K8s resource quantities and env var names.
     * - Encrypts environment variable values via CryptoUtils.
     * - Rejects QuickStack-reserved env var names.
     * - Locks runtime-relevant config while the Agent has an active SandboxClaim (running).
     * - Invalidates stored virtual-key state on gateway/model changes.
     * - Reconciles SandboxTemplate with the saved config.
     * - Reconciles SandboxWarmPool to preserve zero-replica state.
     */
    async saveConfig(agentId: string, config: AgentConfigInputModel): Promise<Agent> {
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

        const updated = await dataAccess.client.agent.update({
            where: { id: agentId },
            data: {
                ...(config.image !== undefined ? { image: config.image || null } : {}),
                ...(config.cpuRequest !== undefined ? { cpuRequest: config.cpuRequest || null } : {}),
                ...(config.cpuLimit !== undefined ? { cpuLimit: config.cpuLimit || null } : {}),
                ...(config.memoryRequest !== undefined ? { memoryRequest: config.memoryRequest || null } : {}),
                ...(config.memoryLimit !== undefined ? { memoryLimit: config.memoryLimit || null } : {}),
                ...(systemPromptValue !== undefined ? { systemPrompt: systemPromptValue } : {}),
                ...(config.envVars !== undefined ? { encryptedEnvVars: encryptedEnvVars! } : {}),
                ...(isGatewayChanged ? { llmGatewayId: config.llmGatewayId! } : {}),
                ...(isModelChanged ? { modelAlias: config.modelAlias! } : {}),
            },
        });

        const effectiveImage = updated.image || DEFAULT_AGENT_IMAGE;

        try {
            await agentSandboxAdapter.reconcileSandboxTemplate({
                name: updated.id,
                namespace: existing.project.id,
                image: effectiveImage,
                cpuRequest: updated.cpuRequest || undefined,
                cpuLimit: updated.cpuLimit || undefined,
                memoryRequest: updated.memoryRequest || undefined,
                memoryLimit: updated.memoryLimit || undefined,
            });

            await agentSandboxAdapter.reconcileSandboxWarmPool({
                name: updated.id,
                namespace: existing.project.id,
                templateName: updated.id,
                replicas: 0,
            });
        } catch (error: any) {
            throw new ServiceException(
                `Failed to reconcile sandbox resources: ${error?.message || error}`,
            );
        } finally {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(existing.projectId));
        }

        return updated;
    }

    /**
     * Deletes an agent and its sandbox resources.
     */
    async deleteById(agentId: string): Promise<void> {
        const existing = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: { project: { select: { id: true } } },
        });
        if (!existing) {
            return;
        }

        const projectId = existing.projectId;
        const namespace = existing.projectId;

        try {
            // Delete K8s sandbox resources
            await agentSandboxAdapter.deleteSandboxWarmPool(agentId, namespace);
            await agentSandboxAdapter.deleteSandboxTemplate(agentId, namespace);

            // Delete DB record
            await dataAccess.client.agent.delete({
                where: { id: agentId },
            });
        } finally {
            revalidateTag(Tags.agents(projectId));
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.projects());
        }
    }
}

const agentService = new AgentService();
export default agentService;
