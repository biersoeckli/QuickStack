import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import liteLlmApiAdapter from "../adapter/litellm-api.adapter";
import { CryptoUtils } from "../utils/crypto.utils";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Tags } from "../utils/cache-tag-generator.utils";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { Constants } from "@/shared/utils/constants";
import secretService from "./secret.service";
import agentSandboxTemplateBuilder from "./agent-sandbox-template-builder.service";
import { AgentModelAliasUtils } from "../utils/agent-model-alias.utils";
import { SandboxClaim } from "../adapter/api-clients/types/agents.models";

const HARNESS_VIRTUAL_KEY_REFERENCE = '__quickstack_runtime_virtual_key__';

export type StartAgentSandboxOptions = {
    timeoutMs?: number;
    env?: Record<string, string>;
    idleTimeoutMinutes?: number;
    customTag?: string;
};

class AgentRuntimeService {

    private async getAgentOrThrow(agentId: string): Promise<AgentExtendedModel> {
        const agent = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: { project: true, llmGateway: true, agentDomains: true, agentVolumes: true, agentFileMounts: true, agentGitSshKey: true },
        });
        if (!agent) {
            throw new ServiceException('Agent not found.');
        }
        return {
            ...agent,
            modelAlias: AgentModelAliasUtils.normalize(agent.modelAlias),
        };
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
            data[key] = value === HARNESS_VIRTUAL_KEY_REFERENCE ? virtualKey : value;
        }
        return data;
    }

    private async createRuntimeSecret(agent: AgentExtendedModel): Promise<void> {
        const namespace = agent.project.id;
        const secretName = this.toSecretName(agent.id);

        if (!agent.llmGateway) {
            throw new ServiceException('LLM Gateway not found for Agent.');
        }
        const gateway = agent.llmGateway;
        if (!gateway.encryptedAdminKey) {
            throw new ServiceException('LLM Gateway admin key is missing.');
        }

        const adminKey = CryptoUtils.decrypt(gateway.encryptedAdminKey);
        const modelAliases = AgentModelAliasUtils.normalize(agent.modelAlias);
        if (modelAliases.length === 0) {
            throw new ServiceException('At least one model alias must be selected for Agent.');
        }
        const virtualKey = await liteLlmApiAdapter.createVirtualKey(
            gateway.baseUrl,
            adminKey,
            modelAliases,
        );

        const decryptedEnvVars = this.decryptEnvVars(agent.encryptedEnvVars ?? null);
        const secretData = this.buildRuntimeSecretData(
            gateway.baseUrl,
            virtualKey,
            agent.systemPrompt ?? null,
            decryptedEnvVars,
        );

        await secretService.createOrReplaceGenericSecret(secretName, namespace, secretData);
    }

    /**
     * Ensures the agent runtime secret exists.
     * Creates a new LiteLLM virtual key and secret if missing; reuses existing if present.
     */
    private async ensureRuntimeSecret(agent: AgentExtendedModel): Promise<void> {
        const namespace = agent.project.id;
        const secretName = this.toSecretName(agent.id);
        const existingSecret = await secretService.getDecodedSecret(secretName, namespace);
        if (existingSecret) {
            return;
        }

        await this.createRuntimeSecret(agent);
    }

    /**
     * Replaces the stored runtime virtual key so deploys apply current model permissions.
     */
    async refreshRuntimeSecret(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        const secretName = this.toSecretName(agent.id);
        const existingSecret = await secretService.getDecodedSecret(secretName, namespace);

        if (existingSecret?.QS_VIRTUAL_KEY && agent.llmGateway?.encryptedAdminKey) {
            const adminKey = CryptoUtils.decrypt(agent.llmGateway.encryptedAdminKey);
            await liteLlmApiAdapter.deleteVirtualKey(
                agent.llmGateway.baseUrl,
                adminKey,
                existingSecret.QS_VIRTUAL_KEY,
            );
        }

        await this.createRuntimeSecret(agent);
    }

    private resolveClaimStatus(claim: any): DeploymentStatus {
        if (claim?.metadata?.deletionTimestamp) {
            return 'SHUTTING_DOWN';
        }

        const conditions: Array<{ type: string; status: string; reason?: string; message?: string }> =
            claim?.status?.conditions || [];

        const ready = conditions.find((c) =>
            (c.type === 'Ready' || c.type === 'Available') && c.status === 'True',
        );
        if (ready) {
            return 'DEPLOYED';
        }

        const readinessCondition = conditions.find((c) =>
            c.type === 'Ready' || c.type === 'Available',
        );
        if (readinessCondition?.reason === 'ClaimExpired' || readinessCondition?.reason === 'Expired') {
            return 'SHUTTING_DOWN';
        }

        const terminalFailureReasons = new Set([
            'TemplateNotFound',
            'WarmPoolNotFound',
            'InvalidMetadata',
            'EnvVarsInjectionRejected',
            'VolumeClaimTemplatesError',
            'ReconcilerError',
        ]);
        if (terminalFailureReasons.has(readinessCondition?.reason ?? '')) {
            return 'ERROR';
        }

        // Ready=False is the controller's normal state while a claim is being fulfilled.
        return 'DEPLOYING';
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
     * Starts a new SandboxClaim for the given agent.
     * - Ensures the runtime secret exists (creates if missing)
     * - Generates a unique claim name via addRandomSuffix
        * - Creates claim with agent sandbox labels
     * - Waits for sandbox readiness
     */
    async startSandbox(agentId: string, userId: string, options?: StartAgentSandboxOptions | number): Promise<{ sandboxName: string }> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        const startOptions: StartAgentSandboxOptions = typeof options === 'number'
            ? { timeoutMs: options }
            : options ?? {};

        await this.ensureRuntimeSecret(agent);

        const sandboxName = KubeObjectNameUtils.toAgentClaimName(agentId);

        await agentSandboxAdapter.createSandboxClaim(
            agentSandboxTemplateBuilder.buildSandboxClaimResource(sandboxName, namespace, agentId, {
                [Constants.QS_ANNOTATION_AGENT_ID]: agentId,
                [Constants.QS_ANNOTATION_PROJECT_ID]: namespace,
                [Constants.QS_ANNOTATION_USER_ID]: userId,
            }, {
                ...(startOptions.customTag ? { [Constants.QS_ANNOTATION_CUSTOM_TAG]: startOptions.customTag } : {}),
            }, {
                env: startOptions.env,
                idleTimeoutMinutes: startOptions.idleTimeoutMinutes,
            }),
        );

        try {
            if (startOptions.timeoutMs !== undefined) {
                await agentSandboxAdapter.waitForSandboxReady(sandboxName, namespace, startOptions.timeoutMs);
            } else {
                await agentSandboxAdapter.waitForSandboxReady(sandboxName, namespace);
            }
        } catch (error) {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
            throw error;
        }

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));

        return { sandboxName };
    }

    /**
     * Stops a specific SandboxClaim.
     */
    async stopSandbox(agentId: string, sandboxName: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        await agentSandboxAdapter.deleteSandboxClaim(sandboxName, namespace);

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));
    }

    async stopAllSandboxes(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        const selector = `${Constants.QS_ANNOTATION_AGENT_ID}=${agentId}`;
        const claims = await agentSandboxAdapter.listSandboxClaims(namespace, selector);

        for (const claim of claims) {
            const sandboxName = claim.metadata?.name;
            if (sandboxName) {
                await agentSandboxAdapter.deleteSandboxClaim(sandboxName, namespace);
            }
        }

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));
    }

    /**
     * Maps a raw k8s SandboxClaim object to an AgentSandboxInfo DTO.
     * Reusable by both listSandboxes and SSE watch delta events.
     */
    mapClaimToSandbox(claim: SandboxClaim, namespace: string): {
        name: string;
        status: DeploymentStatus;
        namespace: string;
        createdAt: string | null;
        customTag?: string;
    } {
        const status = this.resolveClaimStatus(claim);
        return {
            name: claim.metadata?.name || 'unknown',
            status,
            namespace,
            createdAt: claim.metadata?.creationTimestamp || null,
            customTag: claim.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] || undefined,
        };
    }

    /**
     * Lists all SandboxClaims for a given agent.
     * Returns sandbox info including name, status, and creation timestamp.
     */
    async listSandboxes(agentId: string, userId?: string) {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        const selector = userId
            ? `${Constants.QS_ANNOTATION_AGENT_ID}=${agentId},${Constants.QS_ANNOTATION_USER_ID}=${userId}`
            : `${Constants.QS_ANNOTATION_AGENT_ID}=${agentId}`;

        const claims = await agentSandboxAdapter.listSandboxClaims(
            namespace,
            selector,
        );

        return claims.map((claim: SandboxClaim) => this.mapClaimToSandbox(claim, namespace));
    }
}

const agentRuntimeService = new AgentRuntimeService();
export default agentRuntimeService;
