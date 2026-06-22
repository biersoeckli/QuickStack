import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import liteLlmApiAdapter from "../adapter/litellm-api.adapter";
import { CryptoUtils } from "../utils/crypto.utils";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Tags } from "../utils/cache-tag-generator.utils";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";

interface AgentRuntimeSecretData {
    QS_GATEWAY_URL: string;
    QS_VIRTUAL_KEY: string;
    QS_SYSTEM_PROMPT?: string;
    [envName: string]: string | undefined;
}

class AgentRuntimeService {

    /**
     * Status text mapping for user-facing display.
     * DEPLOYED maps to "Running" (not "Deployed") for Agents.
     */
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
            case 'SHUTTING_DOWN':
                return 'Shutting Down';
            case 'PENDING':
                return 'Pending';
            case 'UNKNOWN':
                return 'Unknown';
            case 'BUILDING':
                return 'Building';
            default:
                return 'Unknown';
        }
    }

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
     * Starts an Agent:
     * - Creates a model-restricted LiteLLM virtual key
     * - Assembles and creates the Agent Runtime Secret
     * - Creates a SandboxClaim targeting the Agent's warm pool
     * - Waits for sandbox readiness
     */
    async startAgent(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);

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

        const namespace = agent.project.name;
        await agentSandboxAdapter.createOrReplaceSecret(
            this.toSecretName(agentId),
            namespace,
            secretData,
        );

        await agentSandboxAdapter.createSandboxClaim({
            name: agentId,
            namespace,
            warmPoolName: agentId,
        });

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
     * - Deletes the SandboxClaim
     * - Deletes the Agent Runtime Secret
     */
    async stopAgent(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.name;

        await agentSandboxAdapter.deleteSandboxClaim(agentId, namespace);
        await agentSandboxAdapter.deleteSecret(this.toSecretName(agentId), namespace);

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
        const namespace = agent.project.name;

        const claim = await agentSandboxAdapter.getSandboxClaim(agentId, namespace);

        if (!claim) {
            return 'SHUTDOWN';
        }

        const conditions: Array<{ type: string; status: string; message?: string }> =
            claim?.status?.conditions || [];

        const available = conditions.find((c) => c.type === 'Available' && c.status === 'True');
        if (available) {
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
}

const agentRuntimeService = new AgentRuntimeService();
export default agentRuntimeService;
