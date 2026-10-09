import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import liteLlmApiAdapter from "../adapter/litellm-api.adapter";
import { CryptoUtils } from "../utils/crypto.utils";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { ApiConflictException, ApiNotFoundException, ServiceException } from "@/shared/model/service.exception.model";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Tags } from "../utils/cache-tag-generator.utils";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { Constants } from "@/shared/utils/constants";
import secretService from "./secret.service";
import agentSandboxTemplateBuilder from "./agent-sandbox-template-builder.service";
import { AgentModelAliasUtils } from "../utils/agent-model-alias.utils";
import { SandboxClaim } from "../adapter/api-clients/types/agents.models";
import { agentSandboxCustomTagZodModel } from "@/shared/model/agent-sandbox.model";

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

    private toTaggedVirtualKeySecretName(agentId: string, customTag: string): string {
        return KubeObjectNameUtils.toAgentTaggedVirtualKeySecretId(agentId, customTag);
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
        decryptedEnvVars: Record<string, string>,
    ): Record<string, string> {
        const data: Record<string, string> = {
            QS_GATEWAY_URL: gatewayBaseUrl,
            QS_VIRTUAL_KEY: virtualKey,
        };
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
            { quickstack: { agentId: agent.id, scope: 'agent' } },
        );

        const decryptedEnvVars = this.decryptEnvVars(agent.encryptedEnvVars ?? null);
        const secretData = this.buildRuntimeSecretData(
            gateway.baseUrl,
            virtualKey,
            decryptedEnvVars,
        );

        await secretService.createOrReplaceGenericSecret(secretName, namespace, secretData);
    }

    private async ensureTaggedVirtualKey(agent: AgentExtendedModel, customTag: string): Promise<string> {
        const namespace = agent.project.id;
        const secretName = this.toTaggedVirtualKeySecretName(agent.id, customTag);
        const existingSecret = await secretService.getDecodedSecret(secretName, namespace);
        if (existingSecret?.QS_VIRTUAL_KEY) {
            return existingSecret.QS_VIRTUAL_KEY;
        }

        if (!agent.llmGateway) {
            throw new ServiceException('LLM Gateway not found for Agent.');
        }
        if (!agent.llmGateway.encryptedAdminKey) {
            throw new ServiceException('LLM Gateway admin key is missing.');
        }

        const modelAliases = AgentModelAliasUtils.normalize(agent.modelAlias);
        if (modelAliases.length === 0) {
            throw new ServiceException('At least one model alias must be selected for Agent.');
        }

        const virtualKey = await liteLlmApiAdapter.createVirtualKey(
            agent.llmGateway.baseUrl,
            CryptoUtils.decrypt(agent.llmGateway.encryptedAdminKey),
            modelAliases,
            { quickstack: { agentId: agent.id, customTag, scope: 'agent-sandbox' } },
        );
        await secretService.createOrReplaceGenericSecret(secretName, namespace, {
            QS_VIRTUAL_KEY: virtualKey,
        }, {
            [Constants.QS_ANNOTATION_AGENT_ID]: agent.id,
            [Constants.QS_LABEL_AGENT_TAGGED_VIRTUAL_KEY]: Constants.QS_ANNOTATION_VALUE_TRUE,
        });
        return virtualKey;
    }

    private buildTaggedVirtualKeyEnvOverrides(agent: AgentExtendedModel, virtualKey: string): Record<string, string> {
        const overrides: Record<string, string> = { QS_VIRTUAL_KEY: virtualKey };
        for (const [name, value] of Object.entries(this.decryptEnvVars(agent.encryptedEnvVars ?? null))) {
            if (value === HARNESS_VIRTUAL_KEY_REFERENCE) {
                overrides[name] = virtualKey;
            }
        }
        return overrides;
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

    /**
     * Derives live Agent status from Kubernetes SandboxClaim conditions.
     * - No claim -> SHUTDOWN
     * - Claim exists, Available=True -> DEPLOYED
     * - Claim exists, not yet available -> DEPLOYING
     * - Claim exists, Sandbox suspended -> SUSPENDED
     * - Never returns BUILDING (App-only status)
     */
    async getAgentStatus(agentId: string): Promise<DeploymentStatus> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        const claim = await agentSandboxAdapter.getSandboxClaim(agentId, namespace);

        if (!claim) {
            return 'SHUTDOWN';
        }

        return agentSandboxAdapter.resolveSandboxStatus(claim);
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
            case 'SUSPENDED':
                return 'Suspended';
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

        const sandboxName = KubeObjectNameUtils.toAgentClaimName(agentId);

        const rawCustomTag = startOptions.customTag;
        let customTag: string | undefined;
        if (rawCustomTag !== undefined) {
            const parsedTag = agentSandboxCustomTagZodModel.safeParse(rawCustomTag);
            if (!parsedTag.success) {
                throw new ServiceException('Custom Tag must be between 1 and 63 characters after trimming.');
            }
            customTag = parsedTag.data;
        }

        if (customTag) {
            await this.assertCustomTagAvailable(agentId, namespace, customTag);
        }

        await this.ensureRuntimeSecret(agent);

        const taggedVirtualKey = customTag
            ? await this.ensureTaggedVirtualKey(agent, customTag)
            : undefined;
        const env = taggedVirtualKey
            ? { ...startOptions.env, ...this.buildTaggedVirtualKeyEnvOverrides(agent, taggedVirtualKey) }
            : startOptions.env;

        const perSandboxVolumes = agent.agentVolumes.filter(volume => volume.volumeType === 'PER_SANDBOX');
        const volumeClaimTemplates = customTag && perSandboxVolumes.length > 0
            ? agentSandboxTemplateBuilder.buildSandboxClaimVolumeTemplates(perSandboxVolumes, customTag)
            : undefined;

        await agentSandboxAdapter.createSandboxClaim(
            agentSandboxTemplateBuilder.buildSandboxClaimResource(sandboxName, namespace, agentId, {
                [Constants.QS_ANNOTATION_AGENT_ID]: agentId,
                [Constants.QS_ANNOTATION_PROJECT_ID]: namespace,
                [Constants.QS_ANNOTATION_USER_ID]: userId,
            }, {
                ...(customTag ? { [Constants.QS_ANNOTATION_CUSTOM_TAG]: customTag } : {}),
            }, {
                env,
                idleTimeoutMinutes: startOptions.idleTimeoutMinutes,
                volumeClaimTemplates,
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

    async deleteTaggedVirtualKeys(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        let taggedSecrets: Array<{ name: string; data: Record<string, string> }>;

        try {
            taggedSecrets = await secretService.listDecodedSecretsByLabels(namespace, {
                [Constants.QS_ANNOTATION_AGENT_ID]: agentId,
                [Constants.QS_LABEL_AGENT_TAGGED_VIRTUAL_KEY]: Constants.QS_ANNOTATION_VALUE_TRUE,
            });
        } catch (error) {
            console.warn(`Failed to list tagged LiteLLM virtual keys during Agent cleanup (agentId=${agentId}):`, error);
            return;
        }

        for (const secret of taggedSecrets) {
            try {
                const virtualKey = secret.data.QS_VIRTUAL_KEY;
                if (virtualKey && agent.llmGateway?.encryptedAdminKey) {
                    await liteLlmApiAdapter.deleteVirtualKey(
                        agent.llmGateway.baseUrl,
                        CryptoUtils.decrypt(agent.llmGateway.encryptedAdminKey),
                        virtualKey,
                    );
                }
            } catch (error) {
                console.warn(`Failed to delete tagged LiteLLM virtual key during Agent cleanup (agentId=${agentId}, secret=${secret.name}):`, error);
            }

            try {
                await secretService.deleteSecretSafe(secret.name, namespace);
            } catch (error) {
                console.warn(`Failed to delete tagged virtual key Secret during Agent cleanup (agentId=${agentId}, secret=${secret.name}):`, error);
            }
        }
    }

    private claimMatchesTag(claim: SandboxClaim, agentId: string, customTag: string): boolean {
        return claim.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID] === agentId
            && claim.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] === customTag;
    }

    private async assertCustomTagAvailable(agentId: string, namespace: string, customTag: string): Promise<void> {
        const selector = `${Constants.QS_ANNOTATION_AGENT_ID}=${agentId}`;
        const claims = await agentSandboxAdapter.listSandboxClaims(namespace, selector);
        if (claims.some((claim) => this.claimMatchesTag(claim, agentId, customTag))) {
            throw new ApiConflictException(
                'Conflict',
                `Custom Tag "${customTag}" is already used by another sandbox of this Agent.`,
            );
        }
    }

    private async getOwnedClaimOrThrow(agentId: string, namespace: string, sandboxName: string): Promise<SandboxClaim> {
        const claim = await agentSandboxAdapter.getSandboxClaim(sandboxName, namespace);
        if (!claim) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox not found.');
        }
        const claimAgentId = claim.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID];
        if (claimAgentId !== agentId) {
            throw new ServiceException('Agent sandbox does not belong to this Agent.');
        }
        return claim;
    }

    private async getSandboxObject(namespace: string, claim: SandboxClaim) {
        const sandboxObjectName = claim.status?.sandbox?.name;
        if (!sandboxObjectName) {
            return { sandboxObjectName: null, sandbox: null };
        }
        const sandbox = await agentSandboxAdapter.getSandbox(sandboxObjectName, namespace);
        return { sandboxObjectName, sandbox };
    }

    /**
     * Releases the compute of a running sandbox while keeping its Sandbox object,
     * Service, and per-sandbox volume claims.
     */
    async suspendSandbox(agentId: string, sandboxName: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        const claim = await this.getOwnedClaimOrThrow(agentId, namespace, sandboxName);
        const { sandboxObjectName, sandbox } = await this.getSandboxObject(namespace, claim);
        const status = agentSandboxAdapter.resolveSandboxStatus(claim, sandbox);

        if (status === 'SUSPENDED') {
            return;
        }
        if (status !== 'DEPLOYED' || !sandboxObjectName) {
            throw new ApiConflictException(
                'Conflict',
                'Agent sandbox is not ready. Wait until it is running before suspending.',
            );
        }

        await agentSandboxAdapter.setSandboxOperatingMode(sandboxObjectName, namespace, 'Suspended');
        try {
            await agentSandboxAdapter.waitForSandboxSuspended(sandboxObjectName, namespace);
        } finally {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
        }
    }

    /**
     * Recreates the Pod of a suspended sandbox with the same claims mounted.
     */
    async resumeSandbox(agentId: string, sandboxName: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        const claim = await this.getOwnedClaimOrThrow(agentId, namespace, sandboxName);
        const { sandboxObjectName, sandbox } = await this.getSandboxObject(namespace, claim);
        const status = agentSandboxAdapter.resolveSandboxStatus(claim, sandbox);

        if (status === 'DEPLOYED') {
            return;
        }
        if (!sandboxObjectName) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox runtime not found.');
        }

        await agentSandboxAdapter.setSandboxOperatingMode(sandboxObjectName, namespace, 'Running');
        try {
            await agentSandboxAdapter.waitForSandboxReady(sandboxName, namespace);
        } finally {
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
        }
    }

    /**
     * Resumes the sandbox of this Agent that carries the given Custom Tag.
     */
    async resumeSandboxByTag(agentId: string, customTag: string): Promise<{ sandboxName: string }> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        const selector = `${Constants.QS_ANNOTATION_AGENT_ID}=${agentId}`;
        const claims = await agentSandboxAdapter.listSandboxClaims(namespace, selector);
        const match = claims.find((claim) => this.claimMatchesTag(claim, agentId, customTag));
        const sandboxName = match?.metadata?.name;

        if (!sandboxName) {
            throw new ApiNotFoundException('Not Found', 'No agent sandbox found for the given Custom Tag.');
        }

        await this.resumeSandbox(agentId, sandboxName);
        return { sandboxName };
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
        const status = agentSandboxAdapter.resolveSandboxStatus(claim);
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
