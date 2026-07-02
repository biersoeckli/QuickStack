import { revalidateTag, unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Agent } from "@prisma/client";
import { AgentExtendedWriteModel, AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
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
import crypto from "crypto";
import buildService from "./build.service";
import registryService from "./registry.service";
import deploymentLogService, { dlog } from "./deployment-logs.service";
import { CatchUtils } from "@/shared/utils/catch.utils";
import agentSandboxTemplateBuilder from "./agent-sandbox-template-builder.service";

class AgentService {

    async agentCrdAreInstalled() {
        const result = await CatchUtils.resultOrUndefined(() => agentSandboxAdapter.sandboxClaimApiIsInstalled());
        return !!(result ?? false);
    }

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

    /**
     * Upserts an Agent along with its sub-resources (domains, volumes, file mounts)
     * in a single transaction. Delegates per-item save logic to the respective
     * sub-services ({@link agentDomainService}, {@link agentVolumeService}, {@link agentFileMountService}).
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
        agentExtendedInput: AgentExtendedWriteModel,
        tx?: Prisma.TransactionClient,
    ): Promise<AgentExtendedModel> {
        const run = async (tx: Prisma.TransactionClient) => {
            const {
                agentDomains: agentDomainsInput,
                agentVolumes: agentVolumesInput,
                agentFileMounts: agentFileMountsInput,
                ...agentInputData
            } = agentExtendedInput;
            const savedAgent = await this.saveAgent(agentInputData, tx);
            const savedAgentId = savedAgent.id;


            // Sub-resources via dedicated sub-services
            for (const domain of agentDomainsInput) {
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
                const keepIds = new Set(agentDomainsInput.map((d) => d.id).filter(Boolean) as string[]);
                for (const existing of existingDomains) {
                    if (!keepIds.has(existing.id)) {
                        await agentDomainService.deleteDomain(existing.id, tx);
                    }
                }
            }

            for (const volume of agentVolumesInput) {
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
                const keepIds = new Set(agentVolumesInput.map((v) => v.id).filter(Boolean) as string[]);
                for (const existing of existingVolumes) {
                    if (!keepIds.has(existing.id)) {
                        await agentVolumeService.deleteVolume(existing.id, tx);
                    }
                }
            }

            for (const fileMount of agentFileMountsInput) {
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
                const keepIds = new Set(agentFileMountsInput.map((f) => f.id).filter(Boolean) as string[]);
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

    async saveAgent(data: Prisma.AgentUncheckedCreateInput | Prisma.AgentUncheckedUpdateInput, tx: Prisma.TransactionClient = dataAccess.client): Promise<Agent> {
        const isCreate = !('id' in data) || !data.id;

        let savedItem: Agent | null = null;
        try {
            // if env vars exists, encrypt them
            if (data.encryptedEnvVars) {
                const parsed = JSON.parse(data.encryptedEnvVars as string) as { name: string; value: string }[];
                const encrypted = parsed.map(ev => ({
                    name: ev.name,
                    value: CryptoUtils.encrypt(ev.value),
                }));
                data.encryptedEnvVars = JSON.stringify(encrypted);
            }

            if (isCreate) {
                savedItem = await tx.agent.create({
                    data: {
                        id: KubeObjectNameUtils.toAgentId(data.name as string),
                        ...data
                    } as Prisma.AgentUncheckedCreateInput,
                });
            } else {
                savedItem = await tx.agent.update({
                    where: { id: data.id as string },
                    data: data as Prisma.AgentUncheckedUpdateInput,
                });
            }
            return savedItem;
        } finally {
            if (savedItem) { revalidateTag(Tags.agent(savedItem.id)); }
            if (savedItem) { revalidateTag(Tags.agents(savedItem?.projectId)); }
        }
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

    async deploy(agentId: string, forceBuild = false): Promise<string> {
        const deploymentId = crypto.randomUUID();
        await deploymentLogService.catchErrosAndLog(deploymentId, async () => {
            const agent = await this.getById(agentId);
            await dlog(deploymentId, `
-----------------------------------------------
 Deployment:   ${deploymentId}
 Agent:        ${agent.id}
 Project:      ${agent.projectId}
-----------------------------------------------`, false);

            const hasRunningInstances = await agentRuntimeService.listInstances(agentId).then(instances => instances.length > 0);
            if (hasRunningInstances) {
                throw new ServiceException(
                    'Cannot deploy runtime configuration changes while the Agent is running. Stop the Agent first.',
                );
            }

            if (agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH') {
                const [buildJobName, gitCommitHash, gitCommitMessage, shouldDeployImmediately] = await buildService.buildAgent(deploymentId, agent, forceBuild);
                if (shouldDeployImmediately) {
                    await dlog(deploymentId, `Starting agent deployment with output from build "${buildJobName}"`);
                    await this.reconcileSandboxTemplateDeployment(agent.id, registryService.createContainerRegistryUrlForAppId(agent.id), deploymentId, buildJobName, gitCommitHash, gitCommitMessage);
                }
                return;
            }

            await this.reconcileSandboxTemplateDeployment(agentId, undefined, deploymentId);
        });
        return deploymentId;
    }

    async deployBuiltAgent(
        agentId: string,
        deploymentId: string,
        buildJobName: string,
        gitCommitHash?: string,
        gitCommitMessage?: string,
    ): Promise<Agent> {
        return this.reconcileSandboxTemplateDeployment(
            agentId,
            registryService.createContainerRegistryUrlForAppId(agentId),
            deploymentId,
            buildJobName,
            gitCommitHash,
            gitCommitMessage,
        );
    }

    private async reconcileSandboxTemplateDeployment(
        agentId: string,
        containerImageOverride?: string,
        deploymentId?: string,
        buildJobName?: string,
        gitCommitHash?: string,
        gitCommitMessage?: string,
    ): Promise<Agent> {
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
            const dockerPullSecretName = containerImageOverride
                ? undefined
                : await secretService.createOrUpdateAgentDockerPullSecret(agent);

            const containerImageSource = containerImageOverride ?? agent.containerImageSource;
            if (!containerImageSource) {
                throw new ServiceException('Container image source is missing. Cannot deploy for Agent.');
            }
            await agentSandboxAdapter.reconcileSandboxTemplate(agentSandboxTemplateBuilder.buildSandboxTemplateResource({
                id: agent.id,
                projectId: agent.project.id,
                containerImageSource,
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
            }, {
                dockerPullSecretName,
                deploymentId,
                buildJobName,
                gitCommitHash,
                gitCommitMessage,
            }));

            await agentSandboxAdapter.reconcileSandboxWarmPool(
                agentSandboxTemplateBuilder.buildSandboxWarmPoolResource(agent.id, agent.project.id, agent.warmPoolReplicas),
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
            await secretService.deleteUnusedAgentDockerPullSecret(agent);
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
        await buildService.deleteAllBuildsOfAgent(agentId);

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

}

const agentService = new AgentService();
export default agentService;
