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
import agentSandboxTemplateBuilder, { AgentSandboxManifestInput } from "./agent-sandbox-template-builder.service";
import { AgentModelAliasUtils } from "../utils/agent-model-alias.utils";
import { Sandbox, SandboxClaim } from "../adapter/api-clients/types/agents.models";
import { LiteLlmUserApiKey } from "../adapter/api-clients/types/litellm.models";
import { agentSandboxCustomTagZodModel } from "@/shared/model/agent-sandbox.model";
import pvcService from "./pvc.service";
import configMapService from "./config-map.service";
import networkPolicyService from "./network-policy.service";
import { AgentSandboxUtils } from "../utils/agent-sandbox.utils";
import registryService from "./registry.service";
import { ValueFormatUtils } from "../utils/value-format.utils";

const HARNESS_VIRTUAL_KEY_REFERENCE = '__quickstack_runtime_virtual_key__';

export type StartAgentSandboxOptions = {
    timeoutMs?: number;
    env?: Record<string, string>;
    idleTimeoutMinutes?: number;
    customTag?: string;
};

export type AgentSandboxInfo = {
    name: string;
    status: DeploymentStatus;
    namespace: string;
    createdAt: string | null;
    customTag?: string;
};

class AgentRuntimeService {

    private async getAgentOrThrow(agentId: string): Promise<AgentExtendedModel> {
        const agent = await dataAccess.client.agent.findUnique({
            where: { id: agentId },
            include: {
                project: true,
                llmGateway: true,
                agentDomains: true,
                agentVolumes: true,
                agentFileMounts: true,
                agentGitSshKey: true,
                agentNetworkPolicy: {
                    include: {
                        rules: {
                            include: { targetApp: true },
                        },
                    },
                },
            },
        });
        if (!agent) {
            throw new ServiceException('Agent not found.');
        }
        return {
            ...agent,
            modelAlias: AgentModelAliasUtils.normalize(agent.modelAlias),
        };
    }

    /**
     * An Agent uses the direct base-Sandbox path when it carries at least one
     * PER_CUSTOM_TAG Agent Volume. Agents without one keep the SandboxClaim path.
     */
    private usesDirectSandbox(agent: AgentExtendedModel): boolean {
        return AgentSandboxUtils.usesPerCustomTagVolume(agent.agentVolumes);
    }

    private sandboxMatchesTag(sandbox: Sandbox, agentId: string, customTag: string): boolean {
        return sandbox.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID] === agentId
            && sandbox.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] === customTag;
    }

    /**
     * Builds the sandbox template config used to construct a direct base Sandbox at start.
     * Static volumes cover shared ALL claims and the ensured per-Custom-Tag claims.
     */
    private async buildStartSandboxManifestInput(agent: AgentExtendedModel, customTag: string): Promise<AgentSandboxManifestInput> {
        const containerImageSource = agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH'
            ? registryService.createContainerRegistryUrlForAppId(agent.id)
            : agent.containerImageSource;
        if (!containerImageSource) {
            throw new ServiceException('Container image source is missing. Cannot start Agent Sandbox.');
        }

        const volumePvcData: AgentSandboxManifestInput['volumePvcData'] = [];
        for (const volume of agent.agentVolumes.filter(v => v.volumeType === 'ALL')) {
            volumePvcData.push(await pvcService.ensurePvcForUserAgent(agent.projectId, volume));
        }
        for (const volume of agent.agentVolumes.filter(v => v.volumeType === 'PER_CUSTOM_TAG')) {
            volumePvcData.push(await pvcService.ensureAgentTagPvc(agent.projectId, volume, customTag));
        }
        const { fileVolumes, fileVolumeMounts } = await configMapService.createOrUpdateConfigMapForAgent(agent);

        return {
            agent,
            containerImageSource,
            volumePvcData,
            perSandboxVolumes: [],
            fileVolumes,
            fileVolumeMounts,
        };
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
        decryptedEnvVars: Record<string, string>,
    ): Record<string, string> {
        const data: Record<string, string> = {
            QS_GATEWAY_URL: gatewayBaseUrl,
        };
        for (const [key, value] of Object.entries(decryptedEnvVars)) {
            if (value !== HARNESS_VIRTUAL_KEY_REFERENCE) {
                data[key] = value;
            }
        }
        return data;
    }

    private async createRuntimeSecret(agent: AgentExtendedModel): Promise<void> {
        const namespace = agent.project.id;
        const secretName = KubeObjectNameUtils.toSecretId(agent.id);

        const decryptedEnvVars = this.decryptEnvVars(agent.encryptedEnvVars ?? null);
        const secretData = this.buildRuntimeSecretData(
            agent.llmGateway?.baseUrl ?? '',
            decryptedEnvVars,
        );

        await secretService.createOrReplaceGenericSecret(secretName, namespace, secretData);
    }

    private async ensureSandboxVirtualKey(agent: AgentExtendedModel, sandboxName: string, customTag?: string): Promise<string> {
        const namespace = agent.project.id;
        const secretName = KubeObjectNameUtils.toAgentSandboxVirtualKeySecretId(agent.id, sandboxName);

        if (customTag) {
            await this.deleteStaleTaggedVirtualKeys(agent, customTag, sandboxName);
        }

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

        const baseUrl = agent.llmGateway.baseUrl;
        const adminKey = CryptoUtils.decrypt(agent.llmGateway.encryptedAdminKey);
        let teamId: string | undefined;
        if (customTag) {
            let existingUser = await liteLlmApiAdapter.getUserByIdOrUndefined(baseUrl, adminKey, customTag);
            teamId = ValueFormatUtils.firstLiteLlmTeamId(existingUser?.teams);
            if (!existingUser) {
                try {
                    await liteLlmApiAdapter.createUserWithId(baseUrl, adminKey, customTag);
                } catch (error) {
                    existingUser = await liteLlmApiAdapter.getUserByIdOrUndefined(baseUrl, adminKey, customTag);
                    if (!existingUser) {
                        throw error;
                    }
                    teamId = ValueFormatUtils.firstLiteLlmTeamId(existingUser.teams);
                }
            }
        }

        const virtualKey = await liteLlmApiAdapter.createVirtualKey(
            baseUrl,
            adminKey,
            modelAliases,
            { quickstack: { agentId: agent.id, ...(customTag ? { customTag } : {}), scope: 'agent-sandbox' } },
            customTag,
            teamId,
        );
        await secretService.createOrReplaceGenericSecret(secretName, namespace, {
            QS_VIRTUAL_KEY: virtualKey,
        }, {
            [Constants.QS_ANNOTATION_AGENT_ID]: agent.id,
            [Constants.QS_ANNOTATION_SANDBOX_NAME]: sandboxName,
            ...(customTag ? { [Constants.QS_ANNOTATION_CUSTOM_TAG]: customTag } : {}),
            [Constants.QS_LABEL_AGENT_SANDBOX_VIRTUAL_KEY]: Constants.QS_ANNOTATION_VALUE_TRUE,
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
     * Creates the shared, non-key runtime secret if missing.
     */
    private async ensureRuntimeSecret(agent: AgentExtendedModel): Promise<void> {
        const namespace = agent.project.id;
        const secretName = KubeObjectNameUtils.toSecretId(agent.id);
        const existingSecret = await secretService.getDecodedSecret(secretName, namespace);
        if (existingSecret) {
            return;
        }

        await this.createRuntimeSecret(agent);
    }

    /**
     * Removes a legacy shared virtual key and refreshes the shared, non-key runtime secret.
     */
    async refreshRuntimeSecret(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        const secretName = KubeObjectNameUtils.toSecretId(agent.id);
        const existingSecret = await secretService.getDecodedSecret(secretName, namespace);

        if (existingSecret?.QS_VIRTUAL_KEY && agent.llmGateway?.encryptedAdminKey) {
            const adminKey = CryptoUtils.decrypt(agent.llmGateway.encryptedAdminKey);
            await liteLlmApiAdapter.deleteVirtualKey(
                agent.llmGateway.baseUrl,
                adminKey,
                existingSecret.QS_VIRTUAL_KEY,
            );
        }

        await secretService.deleteSecretSafe(secretName, namespace);
        await this.createRuntimeSecret(agent);
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
        const startOptions: StartAgentSandboxOptions = typeof options === 'number'
            ? { timeoutMs: options }
            : options ?? {};

        const rawCustomTag = startOptions.customTag;
        let customTag: string | undefined;
        if (rawCustomTag !== undefined) {
            const parsedTag = agentSandboxCustomTagZodModel.safeParse(rawCustomTag);
            if (!parsedTag.success) {
                throw new ServiceException('Custom Tag must be between 1 and 63 characters after trimming.');
            }
            customTag = parsedTag.data;
        }

        if (this.usesDirectSandbox(agent)) {
            return await this.startSandboxBySandbox(agent, userId, startOptions, customTag);
        } else {
            return await this.startSandboxByClaim(agent, userId, startOptions, customTag);
        }
    }

    private async startSandboxByClaim(agent: AgentExtendedModel, userId: string, startOptions: StartAgentSandboxOptions, customTag?: string): Promise<{ sandboxName: string }> {
        const sandboxName = KubeObjectNameUtils.toAgentClaimName(agent.id);
        const agentId = agent.id;
        const namespace = agent.project.id;

        if (customTag) {
            await this.assertCustomTagAvailable(agentId, namespace, customTag);
        }

        await this.ensureRuntimeSecret(agent);

        const virtualKey = await this.ensureSandboxVirtualKey(agent, sandboxName, customTag);
        const env = { ...startOptions.env, ...this.buildTaggedVirtualKeyEnvOverrides(agent, virtualKey) };

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
            await this.deleteSandboxVirtualKey(agent, sandboxName);
            revalidateTag(Tags.agent(agentId));
            revalidateTag(Tags.agents(agent.projectId));
            throw error;
        }

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));

        return { sandboxName };
    }

    /**
     * Starts a directly created base Sandbox for an Agent with a PER_CUSTOM_TAG volume.
     * Requires a Custom Tag, ensures the runtime secret, the tagged virtual key, and the
     * per-Custom-Tag PersistentVolumeClaims before creating the Sandbox.
     */
    private async startSandboxBySandbox(
        agent: AgentExtendedModel,
        _userId: string,
        startOptions: StartAgentSandboxOptions,
        customTag?: string,
    ): Promise<{ sandboxName: string }> {
        const namespace = agent.projectId;
        if (!customTag) {
            throw new ServiceException('A Custom Tag is required for Agents with a PER_CUSTOM_TAG volume.');
        }

        await this.assertCustomTagAvailable(agent.id, namespace, customTag);
        await this.ensureRuntimeSecret(agent);

        const dockerPullSecretName = await secretService.createOrUpdateAgentDockerPullSecret(agent);

        const manifestInput = await this.buildStartSandboxManifestInput(agent, customTag);
        const sandboxName = KubeObjectNameUtils.toAgentSandboxName(agent.id, customTag);
        const virtualKey = await this.ensureSandboxVirtualKey(agent, sandboxName, customTag);
        const env = { ...startOptions.env, ...this.buildTaggedVirtualKeyEnvOverrides(agent, virtualKey) };

        await networkPolicyService.reconcileAgentSandboxNetworkPolicy(
            agent.id,
            namespace,
            agent.agentNetworkPolicy ?? null,
        );

        await agentSandboxAdapter.createSandbox(
            agentSandboxTemplateBuilder.buildSandboxResource(manifestInput, customTag, {
                sandboxName,
                idleTimeoutMinutes: startOptions.idleTimeoutMinutes,
                env,
                deploymentInfo: { dockerPullSecretName },
            }),
        );

        try {
            if (startOptions.timeoutMs !== undefined) {
                await agentSandboxAdapter.waitForSandboxObjectReady(sandboxName, namespace, startOptions.timeoutMs);
            } else {
                await agentSandboxAdapter.waitForSandboxObjectReady(sandboxName, namespace);
            }
        } catch (error) {
            await this.deleteSandboxVirtualKey(agent, sandboxName);
            revalidateTag(Tags.agent(agent.id));
            revalidateTag(Tags.agents(agent.projectId));
            throw error;
        }

        revalidateTag(Tags.agent(agent.id));
        revalidateTag(Tags.agents(agent.projectId));

        return { sandboxName };
    }

    /**
     * Stops a specific SandboxClaim.
     */
    async stopSandbox(agentId: string, sandboxName: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        if (this.usesDirectSandbox(agent)) {
            await agentSandboxAdapter.deleteSandbox(sandboxName, namespace);
        } else {
            await agentSandboxAdapter.deleteSandboxClaim(sandboxName, namespace);
        }
        await this.deleteSandboxVirtualKey(agent, sandboxName);

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
                await this.deleteSandboxVirtualKey(agent, sandboxName);
            }
        }

        const sandboxes = await agentSandboxAdapter.listSandboxes(namespace, selector);
        for (const sandbox of sandboxes) {
            const sandboxName = sandbox.metadata?.name;
            if (sandboxName) {
                await agentSandboxAdapter.deleteSandbox(sandboxName, namespace);
                await this.deleteSandboxVirtualKey(agent, sandboxName);
            }
        }

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));
    }

    /**
     * Deletes every virtual-key Secret owned by the Agent, including legacy
     * per-Custom-Tag Keys and the newer per-Sandbox Keys.
     */
    async deleteAllSandboxVirtualKeys(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        let secrets: Awaited<ReturnType<typeof secretService.listDecodedSecretsByLabels>>;

        try {
            secrets = await secretService.listDecodedSecretsByLabels(agent.project.id, {
                [Constants.QS_ANNOTATION_AGENT_ID]: agentId,
            });
        } catch (error) {
            console.warn(`Failed to list LiteLLM virtual key Secrets during Agent cleanup (agentId=${agentId}):`, error);
            return;
        }

        for (const secret of secrets) {
            const isLegacyTagKey = secret.labels[Constants.QS_LABEL_AGENT_TAGGED_VIRTUAL_KEY] === Constants.QS_ANNOTATION_VALUE_TRUE;
            const isSandboxKey = secret.labels[Constants.QS_LABEL_AGENT_SANDBOX_VIRTUAL_KEY] === Constants.QS_ANNOTATION_VALUE_TRUE;
            if (!isLegacyTagKey && !isSandboxKey) {
                continue;
            }

            await this.deleteVirtualKeySecret(agent, secret);
        }
    }

    /**
     * Deletes only the legacy per-Custom-Tag Keys that predate per-Sandbox Keys.
     * Used during deploy so running Sandboxes keep their current key.
     */
    async deleteLegacyTaggedVirtualKeys(agentId: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        let secrets: Awaited<ReturnType<typeof secretService.listDecodedSecretsByLabels>>;

        try {
            secrets = await secretService.listDecodedSecretsByLabels(agent.project.id, {
                [Constants.QS_ANNOTATION_AGENT_ID]: agentId,
                [Constants.QS_LABEL_AGENT_TAGGED_VIRTUAL_KEY]: Constants.QS_ANNOTATION_VALUE_TRUE,
            });
        } catch (error) {
            console.warn(`Failed to list legacy tagged LiteLLM virtual keys during Agent deploy (agentId=${agentId}):`, error);
            return;
        }

        for (const secret of secrets) {
            await this.deleteVirtualKeySecret(agent, secret);
        }
    }

    /**
     * A Custom Tag can only own one running Sandbox per Agent. Before starting
     * one, remove any keys left behind by earlier starts for the same Agent and
     * Custom Tag. Keys owned by other Agents are never touched, even when they
     * use the same Custom Tag.
     */
    private async deleteStaleTaggedVirtualKeys(agent: AgentExtendedModel, customTag: string, sandboxName: string): Promise<void> {
        await this.deleteLegacyTaggedVirtualKey(agent, customTag);
        await this.deleteSandboxVirtualKey(agent, sandboxName);
        await this.deleteTaggedVirtualKeysFromLiteLlm(agent, customTag);
    }

    private async deleteLegacyTaggedVirtualKey(agent: AgentExtendedModel, customTag: string): Promise<void> {
        const secretName = KubeObjectNameUtils.toAgentTaggedVirtualKeySecretId(agent.id, customTag);
        await this.deleteVirtualKeySecretByName(agent, secretName);
    }

    private async deleteTaggedVirtualKeysFromLiteLlm(agent: AgentExtendedModel, customTag: string): Promise<void> {
        if (!agent.llmGateway?.encryptedAdminKey) {
            return;
        }

        try {
            const adminKey = CryptoUtils.decrypt(agent.llmGateway.encryptedAdminKey);
            const keys = await liteLlmApiAdapter.listVirtualKeysByUserId(agent.llmGateway.baseUrl, adminKey, customTag);
            const staleKeys = keys
                .filter((key) => this.matchesTaggedSandboxKey(key, agent.id, customTag))
                .map((key) => key.token)
                .filter((token): token is string => !!token);

            await liteLlmApiAdapter.deleteVirtualKeys(agent.llmGateway.baseUrl, adminKey, staleKeys);
        } catch (error) {
            console.warn(`Failed to delete stale LiteLLM virtual keys for Custom Tag "${customTag}" (agentId=${agent.id}):`, error);
        }
    }

    private matchesTaggedSandboxKey(key: LiteLlmUserApiKey, agentId: string, customTag: string): boolean {
        const metadata = key.metadata?.quickstack;
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
            return false;
        }

        const quickstackMetadata = metadata as Record<string, unknown>;
        return quickstackMetadata.agentId === agentId
            && quickstackMetadata.customTag === customTag
            && quickstackMetadata.scope === 'agent-sandbox';
    }

    private async deleteSandboxVirtualKey(agent: AgentExtendedModel, sandboxName: string): Promise<void> {
        const secretName = KubeObjectNameUtils.toAgentSandboxVirtualKeySecretId(agent.id, sandboxName);
        await this.deleteVirtualKeySecretByName(agent, secretName);
    }

    private async deleteVirtualKeySecretByName(agent: AgentExtendedModel, secretName: string): Promise<void> {
        let secret: Record<string, string> | null = null;
        try {
            secret = await secretService.getDecodedSecret(secretName, agent.project.id);
        } catch (error) {
            console.warn(`Failed to read virtual key Secret "${secretName}" for Agent ${agent.id}:`, error);
        }

        await this.deleteVirtualKeySecret(agent, {
            name: secretName,
            data: secret ?? {},
        });
    }

    private async deleteVirtualKeySecret(
        agent: AgentExtendedModel,
        secret: { name: string; data: Record<string, string> },
    ): Promise<void> {
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
            console.warn(`Failed to delete LiteLLM virtual key for Secret "${secret.name}" (agentId=${agent.id}):`, error);
        }

        try {
            await secretService.deleteSecretSafe(secret.name, agent.project.id);
        } catch (error) {
            console.warn(`Failed to delete virtual key Secret "${secret.name}" (agentId=${agent.id}):`, error);
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

        const sandboxes = await agentSandboxAdapter.listSandboxes(namespace, selector);
        if (sandboxes.some((sandbox) => this.sandboxMatchesTag(sandbox, agentId, customTag))) {
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

    private async getOwnedSandboxOrThrow(agentId: string, namespace: string, sandboxName: string): Promise<Sandbox> {
        const sandbox = await agentSandboxAdapter.getSandbox(sandboxName, namespace);
        if (!sandbox) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox not found.');
        }
        if (sandbox.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID] !== agentId) {
            throw new ServiceException('Agent sandbox does not belong to this Agent.');
        }
        return sandbox;
    }

    /**
     * Releases the compute of a running sandbox while keeping its Sandbox object,
     * Service, and per-sandbox volume claims.
     */
    async suspendSandbox(agentId: string, sandboxName: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;

        if (this.usesDirectSandbox(agent)) {
            const sandbox = await this.getOwnedSandboxOrThrow(agentId, namespace, sandboxName);
            const directStatus = AgentSandboxUtils.resolveSandboxObjectStatus(sandbox);
            if (directStatus === 'SUSPENDED') {
                return;
            }
            if (directStatus !== 'DEPLOYED') {
                throw new ApiConflictException(
                    'Conflict',
                    'Agent sandbox is not ready. Wait until it is running before suspending.',
                );
            }
            await agentSandboxAdapter.setSandboxOperatingMode(sandboxName, namespace, 'Suspended');
            try {
                await agentSandboxAdapter.waitForSandboxSuspended(sandboxName, namespace);
            } finally {
                revalidateTag(Tags.agent(agentId));
                revalidateTag(Tags.agents(agent.projectId));
            }
            return;
        }

        const claim = await this.getOwnedClaimOrThrow(agentId, namespace, sandboxName);
        const { sandboxObjectName, sandbox } = await this.getSandboxObject(namespace, claim);
        const status = AgentSandboxUtils.resolveSandboxStatus(claim, sandbox);

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

        if (this.usesDirectSandbox(agent)) {
            const sandbox = await agentSandboxAdapter.getSandbox(sandboxName, namespace);
            if (!sandbox) {
                throw new ApiNotFoundException('Not Found', 'Agent sandbox runtime not found.');
            }
            if (AgentSandboxUtils.resolveSandboxObjectStatus(sandbox) === 'DEPLOYED') {
                return;
            }
            await agentSandboxAdapter.setSandboxOperatingMode(sandboxName, namespace, 'Running');
            try {
                await agentSandboxAdapter.waitForSandboxObjectReady(sandboxName, namespace);
            } finally {
                revalidateTag(Tags.agent(agentId));
                revalidateTag(Tags.agents(agent.projectId));
            }
            return;
        }

        const claim = await this.getOwnedClaimOrThrow(agentId, namespace, sandboxName);
        const { sandboxObjectName, sandbox } = await this.getSandboxObject(namespace, claim);
        const status = AgentSandboxUtils.resolveSandboxStatus(claim, sandbox);

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

        if (this.usesDirectSandbox(agent)) {
            const sandboxes = await agentSandboxAdapter.listSandboxes(namespace, selector);
            const match = sandboxes.find((sandbox) => this.sandboxMatchesTag(sandbox, agentId, customTag));
            const directName = match?.metadata?.name;
            if (!directName) {
                throw new ApiNotFoundException('Not Found', 'No agent sandbox found for the given Custom Tag.');
            }
            await this.resumeSandbox(agentId, directName);
            return { sandboxName: directName };
        }

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
    mapClaimToSandbox(claim: SandboxClaim, namespace: string): AgentSandboxInfo {
        const status = AgentSandboxUtils.resolveSandboxStatus(claim);
        return {
            name: claim.metadata?.name || 'unknown',
            status,
            namespace,
            createdAt: claim.metadata?.creationTimestamp || null,
            customTag: claim.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] || undefined,
        };
    }

    /**
     * Maps a directly created base Sandbox object to an AgentSandboxInfo DTO.
     */
    mapSandboxToSandbox(sandbox: Sandbox, namespace: string): AgentSandboxInfo {
        return {
            name: sandbox.metadata?.name || 'unknown',
            status: AgentSandboxUtils.resolveSandboxObjectStatus(sandbox),
            namespace,
            createdAt: sandbox.metadata?.creationTimestamp || null,
            customTag: sandbox.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] || undefined,
        };
    }

    /**
     * Deletes all stored data of one Custom Tag across the Agent's PER_CUSTOM_TAG volumes.
     * Rejected while a sandbox with that tag exists. Idempotent otherwise.
     */
    async deleteTag(agentId: string, customTag: string): Promise<void> {
        const agent = await this.getAgentOrThrow(agentId);
        const namespace = agent.project.id;
        const selector = `${Constants.QS_ANNOTATION_AGENT_ID}=${agentId}`;

        const claims = await agentSandboxAdapter.listSandboxClaims(namespace, selector);
        if (claims.some((claim) => this.claimMatchesTag(claim, agentId, customTag))) {
            throw new ApiConflictException(
                'Conflict',
                `Custom Tag "${customTag}" is currently used by a running sandbox. Stop it before deleting its data.`,
            );
        }

        const sandboxes = await agentSandboxAdapter.listSandboxes(namespace, selector);
        if (sandboxes.some((sandbox) => this.sandboxMatchesTag(sandbox, agentId, customTag))) {
            throw new ApiConflictException(
                'Conflict',
                `Custom Tag "${customTag}" is currently used by a running sandbox. Stop it before deleting its data.`,
            );
        }

        await pvcService.deletePvcForAgentTag(namespace, agentId, customTag);

        revalidateTag(Tags.agent(agentId));
        revalidateTag(Tags.agents(agent.projectId));
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

        if (this.usesDirectSandbox(agent)) {
            const sandboxes = await agentSandboxAdapter.listSandboxes(namespace, selector);
            return sandboxes.map((sandbox: Sandbox) => this.mapSandboxToSandbox(sandbox, namespace));
        }

        const claims = await agentSandboxAdapter.listSandboxClaims(
            namespace,
            selector,
        );

        return claims.map((claim: SandboxClaim) => this.mapClaimToSandbox(claim, namespace));
    }
}

const agentRuntimeService = new AgentRuntimeService();
export default agentRuntimeService;
