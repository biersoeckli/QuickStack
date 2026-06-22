import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Agent, Prisma } from "@prisma/client";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import { AgentModel } from "@/shared/model/generated-zod";

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
            select: { projectType: true, id: true, name: true },
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
                namespace: project.name,
                image: DEFAULT_AGENT_IMAGE,
            });

            // Reconcile zero-replica SandboxWarmPool
            await agentSandboxAdapter.reconcileSandboxWarmPool({
                name: agentId,
                namespace: project.name,
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
     * Deletes an agent and its sandbox resources.
     */
    async deleteById(agentId: string): Promise<void> {
        const existing = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: { project: { select: { name: true } } },
        });
        if (!existing) {
            return;
        }

        const projectId = existing.projectId;
        const namespace = existing.project.name;

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
