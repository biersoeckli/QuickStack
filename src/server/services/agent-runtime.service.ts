import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import agentSandboxAdapter, {
    SANDBOX_API_GROUP,
    SANDBOX_API_VERSION,
} from "../adapter/agent-sandbox.adapter";
import liteLlmApiAdapter from "../adapter/litellm-api.adapter";
import { CryptoUtils } from "../utils/crypto.utils";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Tags } from "../utils/cache-tag-generator.utils";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { Constants } from "@/shared/utils/constants";
import { KubernetesResource } from "@/shared/model/base-kubernetes-object";
import secretService from "./secret.service";

class AgentRuntimeService {

    private async getAgentOrThrow(agentId: string): Promise<AgentWithRelationsModel> {
        const agent = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: { project: true, llmGateway: true },
        });
        if (!agent) {
            throw new ServiceException('Agent not found.');
        }
        return agent;
    }

    private toSecretName(agentId: string): string {
        return KubeObjectNameUtils.toSecretId(agentId);
    }

    private decryptEnvVars(encryptedEnvVarsJson: string | null): Record<string, string> {
        if (!encryptedEnvVarsJson) {
            return {};
        }
        const parsed = JSON.parse(encryptedEnvVarsJson) as Array<{ name: string; value: string }>;
        const result: Record<string, string> = {};
        for (const ev of parsed) {
            result[ev.name] = CryptoUtils.decrypt(ev.value);
        }
        return result;
    }

    private buildRuntimeSecretData(
        gatewayBaseUrl: string,
        virtualKey: string,
        systemPrompt: string | null,
        decryptedEnvVars: Record<string, string>,
    ): Record<string, string> {
        const data: Record<string, string> = {
            QS_GATEWAY_URL: gatewayBaseUrl,
            QS_VIRTUAL_KEY: virtualKey,
            OPENCODE_SERVER_PASSWORD: CryptoUtils.generateStrongPasswort(),
        };
        if (systemPrompt) {
            data.QS_SYSTEM_PROMPT = systemPrompt;
        }
        for (const [key, value] of Object.entries(decryptedEnvVars)) {
            data[key] = value;
        }
        return data;
    }

    /**
     * Ensures the agent runtime secret exists.
     * Creates a new LiteLLM virtual key and secret if missing; reuses existing if present.
     */
    private async ensureRuntimeSecret(agent: AgentWithRelationsModel): Promise<void> {
        const namespace = agent.project.id;
        const secretName = this.toSecretName(agent.id);
        const existingSecret = await secretService.getDecodedSecret(secretName, namespace);
        if (existingSecret) {
            return; // Secret already exists, reuse it
        }

        if (!agent.llmGateway) {
            throw new ServiceException('LLM Gateway not found for Agent.');
        }
        const gateway = agent.llmGateway;
        if (!gateway.encryptedAdminKey) {
            throw new ServiceException('LLM Gateway admin key is missing.');
        }

        const adminKey = CryptoUtils.decrypt(gateway.encryptedAdminKey);
        const virtualKey = await liteLlmApiAdapter.createVirtualKey(
            gateway.baseUrl,
            adminKey,
            agent.modelAlias,
        );

        const decryptedEnvVars = this.decryptEnvVars(agent.encryptedEnvVars);
        const secretData = this.buildRuntimeSecretData(
            gateway.baseUrl,
            virtualKey,
            agent.systemPrompt,
            decryptedEnvVars,
        );

        await secretService.createOrReplaceGenericSecret(secretName, namespace, secretData);
    }

    private resolveClaimStatus(claim: any): DeploymentStatus {
        const conditions: Array<{ type: string; status: string; message?: string }> =
            claim?.status?.conditions || [];

        const ready = conditions.find((c) =>
            (c.type === 'Ready' || c.type === 'Available') && c.status === 'True',
        );
        if (ready) {
            return 'DEPLOYED';
        }

        const failed = conditions.find((c) =>
            (c.type === 'Ready' || c.type === 'Available') && c.status === 'False',
        );
        if (failed) {
            return 'ERROR';
        }

        return 'DEPLOYING';
    }

    private buildSandboxClaimResource(
        claimName: string,
        namespace: string,
        warmPoolName: string,
        labels?: Record<string, string>,
    ): KubernetesResource {
        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxClaim',
            metadata: {
                name: claimName,
                namespace,
                ...(labels ? { labels } : {}),
            },
            spec: {
                warmPoolRef: {
                    name: warmPoolName,
                },
            },
        };
    }

    /**
     * Starts an Agent:
     * - Creates a model-restricted LiteLLM virtual key
     * - Assembles and creates the Agent Runtime Secret
     * - Creates a SandboxClaim targeting the Agent's warm pool
     * - Waits for sandbox readiness
     */
    async startAgent(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        await this.ensureRuntimeSecret(agent);

        await agentSandboxAdapter.createSandboxClaim(
            this.buildSandboxClaimResource(agentId, namespace, agentId, {
                [Constants.QS_ANNOTATION_AGENT_INSTANCE_LABEL]: agentId,
            }),
        );

        try {
            await agentSandboxAdapter.waitForSandboxReady(agentId, namespace);
        } catch (error) {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
            throw error;
        }

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));
    }

    /**
     * Stops a running Agent:
     * - Deletes all SandboxClaims for the agent
     * - Deletes the Agent Runtime Secret
     */
    async stopAgent(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        // Delete all instance claims for this agent
        const claims = await agentSandboxAdapter.listSandboxClaims(
            namespace,
            `${Constants.QS_ANNOTATION_AGENT_INSTANCE_LABEL}=${agentId}`,
        );
        for (const claim of claims) {
            const claimName = claim.metadata?.name;
            if (claimName) {
                await agentSandboxAdapter.deleteSandboxClaim(claimName, namespace);
            }
        }
        // Also delete legacy single claim (named after agentId) for backward compat
        await agentSandboxAdapter.deleteSandboxClaim(agentId, namespace);

        await secretService.deleteSecretSafe(this.toSecretName(agentId), namespace);

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));
    }

    /**
     * Derives live Agent status from Kubernetes SandboxClaim conditions.
     * - No claim -> SHUTDOWN
     * - Claim exists, Available=True -> DEPLOYED
     * - Claim exists, not yet available -> DEPLOYING
     * - Never returns BUILDING (App-only status)
     */
    async getAgentStatus(agentId: string): Promise<DeploymentStatus> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        const claim = await agentSandboxAdapter.getSandboxClaim(agentId, namespace);

        if (!claim) {
            return 'SHUTDOWN';
        }

        return this.resolveClaimStatus(claim);
    }

    statusTextFor(status: DeploymentStatus): string {
        switch (status) {
            case 'DEPLOYED':
                return 'Running';
            case 'SHUTDOWN':
                return 'Shut Down';
            case 'DEPLOYING':
                return 'Deploying';
            case 'ERROR':
                return 'Error';
            default:
                return status;
        }
    }

    /**
     * Starts a new SandboxClaim instance for the given agent.
     * - Ensures the runtime secret exists (creates if missing)
     * - Generates a unique claim name via addRandomSuffix
     * - Creates claim with agent instance label
     * - Waits for sandbox readiness
     */
    async startInstance(agentId: string): Promise<{ claimName: string }> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        await this.ensureRuntimeSecret(agent);

        const claimName = KubeObjectNameUtils.addRandomSuffix(agentId);

        await agentSandboxAdapter.createSandboxClaim(
            this.buildSandboxClaimResource(claimName, namespace, agentId, {
                [Constants.QS_ANNOTATION_AGENT_INSTANCE_LABEL]: agentId,
            }),
        );

        try {
            await agentSandboxAdapter.waitForSandboxReady(claimName, namespace);
        } catch (error) {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
            throw error;
        }

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));

        return { claimName };
    }

    /**
     * Stops a specific SandboxClaim instance.
     */
    async stopInstance(agentId: string, claimName: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        await agentSandboxAdapter.deleteSandboxClaim(claimName, namespace);

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));
    }

    /**
     * Maps a raw k8s SandboxClaim object to an AgentInstanceInfo DTO.
     * Reusable by both listInstances and SSE watch delta events.
     */
    mapClaimToInstance(claim: any, namespace: string): {
        name: string;
        status: DeploymentStatus;
        namespace: string;
        createdAt: string | null;
    } {
        const status = this.resolveClaimStatus(claim);
        return {
            name: claim.metadata?.name || 'unknown',
            status,
            namespace,
            createdAt: claim.metadata?.creationTimestamp || null,
        };
    }

    /**
     * Lists all SandboxClaim instances for a given agent.
     * Returns instance info including name, status, and creation timestamp.
     */
    async listInstances(agentId: string): Promise<Array<{
        name: string;
        status: DeploymentStatus;
        namespace: string;
        createdAt: string | null;
    }>> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        const claims = await agentSandboxAdapter.listSandboxClaims(
            namespace,
            `${Constants.QS_ANNOTATION_AGENT_INSTANCE_LABEL}=${agentId}`,
        );

        return claims.map((claim: any) => this.mapClaimToInstance(claim, namespace));
    }
}

const agentRuntimeService = new AgentRuntimeService();
export default agentRuntimeService;
