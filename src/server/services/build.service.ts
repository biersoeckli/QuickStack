import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { BuildJobModel } from "@/shared/model/build-job";
import { GlobalBuildJobModel } from "@/shared/model/global-build-job.model";
import { PodsInfoModel } from "@/shared/model/pods-info.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import { Constants } from "../../shared/utils/constants";
import dataAccess from "../adapter/db.client";
import k3s from "../adapter/kubernetes-api.adapter";
import buildQueueInitContainer from "./build-job-builders/build-init-container.service";
import dockerfileBuildJobBuilder from "./build-job-builders/dockerfile-build-job-builder.service";
import railpackBuildJobBuilder from "./build-job-builders/railpack-build-job-builder.service";
import { BuildJobBuilder } from "./build-job-builders/build-job-builder.interface";
import clusterService from "./cluster.service";
import { dlog } from "./deployment-logs.service";
import gitService from "./git.service";
import namespaceService from "./namespace.service";
import paramService, { ParamService } from "./param.service";
import registryService, { BUILD_NAMESPACE } from "./registry.service";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { V1JobStatus, V1ResourceRequirements } from "@kubernetes/client-node";
import appGitSshKeyService from "./app-git-ssh-key.service";
import agentGitSshKeyService from "./agent-git-ssh-key.service";

type BuildWorkload = AppExtendedModel | AgentExtendedModel;

class BuildService {

    async buildApp(deploymentId: string, app: AppExtendedModel, forceBuild: boolean = false): Promise<[string, string, string, boolean]> {
        return this.buildWorkload(deploymentId, app, 'app', forceBuild);
    }

    async buildAgent(deploymentId: string, agent: AgentExtendedModel, forceBuild: boolean = false): Promise<[string, string, string, boolean]> {
        return this.buildWorkload(deploymentId, agent, 'agent', forceBuild);
    }

    async buildWorkload(deploymentId: string, workload: BuildWorkload, workloadType: WorkloadType, forceBuild: boolean = false): Promise<[string, string, string, boolean]> {
        await namespaceService.createNamespaceIfNotExists(BUILD_NAMESPACE);
        const registryLocation = await paramService.getString(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION);
        await registryService.deployRegistry(registryLocation!);

        const buildsForWorkload = await this.getBuildsForWorkload(workload.id);
        if (buildsForWorkload.some((job) => job.status === 'RUNNING' || job.status === 'PENDING')) {
            throw new ServiceException(`A build job is already running for this ${workloadType}.`);
        }

        const buildMethod = this.getBuildMethod(workload, workloadType);
        await dlog(deploymentId, `Initialized ${workloadType} build...`);
        await dlog(deploymentId, `Selected build method: ${buildMethod}`);
        await dlog(deploymentId, `Trying to clone repository...`);

        const latestSuccessfulBuild = buildsForWorkload.find(x => x.status === 'SUCCEEDED');
        const { latestRemoteGitHash, latestRemoteGitCommitMessage } = await gitService.openGitContext({
            ...workload,
            workloadType,
        }, async (ctx) => {
            if (buildMethod === 'DOCKERFILE') {
                await ctx.checkIfDockerfileExists();
            }

            const [hash, message] = await Promise.all([
                ctx.getLatestRemoteCommitHash(),
                ctx.getLatestRemoteCommitMessage(),
            ]);
            return { latestRemoteGitHash: hash, latestRemoteGitCommitMessage: message };
        });

        await dlog(deploymentId, `Cloned repository successfully`);
        await dlog(deploymentId, `Latest remote git hash: ${latestRemoteGitHash}`);

        if (!forceBuild && latestSuccessfulBuild?.gitCommit && latestRemoteGitHash &&
            latestSuccessfulBuild.gitCommit === latestRemoteGitHash) {
            if (await registryService.doesImageExist(workload.id, 'latest')) {
                await dlog(deploymentId, `Latest build is already up to date with git repository, using container from last build.`);
                return [latestSuccessfulBuild.name, latestRemoteGitHash, latestRemoteGitCommitMessage, true];
            }

            await dlog(deploymentId, `Docker Image for last build not found in internal registry, creating new build.`);
        }

        return this.createAndStartBuildJob(deploymentId, workload, workloadType, latestRemoteGitHash, latestRemoteGitCommitMessage);
    }

    private async createAndStartBuildJob(
        deploymentId: string,
        workload: BuildWorkload,
        workloadType: WorkloadType,
        latestRemoteGitHash: string,
        latestRemoteGitCommitMessage: string = '',
    ): Promise<[string, string, string, boolean]> {
        const buildName = KubeObjectNameUtils.addRandomSuffix(KubeObjectNameUtils.toJobName(workload.id));
        const buildMethod = this.getBuildMethod(workload, workloadType);
        const builder = this.getBuilder(buildMethod);

        await dlog(deploymentId, `Creating build job with name: ${buildName}`);
        await buildQueueInitContainer.ensureRbacResources();

        if (buildMethod === 'DOCKERFILE') {
            await dlog(deploymentId, `Dockerfile path: ${workload.dockerfilePath || './Dockerfile'}`);
        } else {
            await dlog(deploymentId, `Railpack build will run queue wait, prepare step, and BuildKit build in sequence.`);
        }

        const queuedAt = Date.now().toString();
        const schedulingConfig = await this.getBuildSchedulingConfig(deploymentId);
        const gitSshPrivateKeySecretName = workload.sourceType === 'GIT_SSH'
            ? await this.createTemporaryGitSshBuildSecret(workloadType, workload.id, buildName)
            : undefined;

        try {
            const jobDefinition = await builder.buildJobDefinition({
                workload,
                workloadType,
                buildName,
                deploymentId,
                latestRemoteGitHash,
                latestRemoteGitCommitMessage,
                queuedAt,
                ...schedulingConfig,
                gitSshPrivateKeySecretName,
            });

            await k3s.batch.createNamespacedJob(BUILD_NAMESPACE, jobDefinition);
        } catch (error) {
            await this.deleteTemporaryGitSshBuildSecret(gitSshPrivateKeySecretName);
            throw error;
        }
        await dlog(deploymentId, `Build job ${buildName} scheduled successfully`);

        return [buildName, latestRemoteGitHash, latestRemoteGitCommitMessage, false];
    }

    private getBuildMethod(workload: BuildWorkload, workloadType: WorkloadType): AppBuildMethod {
        if (workloadType === 'agent') {
            return 'DOCKERFILE';
        }
        return workload.buildMethod === 'DOCKERFILE' ? 'DOCKERFILE' : 'RAILPACK';
    }

    private getBuilder(buildMethod: AppBuildMethod): BuildJobBuilder {
        return buildMethod === 'DOCKERFILE' ? dockerfileBuildJobBuilder : railpackBuildJobBuilder;
    }

    private async getBuildSchedulingConfig(deploymentId: string): Promise<{
        nodeSelector?: Record<string, string>;
        resources?: V1ResourceRequirements;
    }> {
        const buildNode = await paramService.getString(ParamService.BUILD_NODE);
        let nodeSelector: Record<string, string> | undefined;
        let resources: V1ResourceRequirements | undefined;

        if (buildNode === Constants.BUILD_NODE_K3S_NATIVE_VALUE) {
            const [memoryLimit, memoryReservation, cpuLimit, cpuReservation] = await Promise.all([
                paramService.getNumber(ParamService.BUILD_MEMORY_LIMIT),
                paramService.getNumber(ParamService.BUILD_MEMORY_RESERVATION),
                paramService.getNumber(ParamService.BUILD_CPU_LIMIT),
                paramService.getNumber(ParamService.BUILD_CPU_RESERVATION),
            ]);
            const hasLimits = memoryLimit || cpuLimit;
            const hasRequests = memoryReservation || cpuReservation;
            if (hasLimits || hasRequests) {
                resources = {
                    ...(hasLimits ? {
                        limits: {
                            ...(cpuLimit ? { cpu: `${cpuLimit}m` } : {}),
                            ...(memoryLimit ? { memory: `${memoryLimit}M` } : {}),
                        }
                    } : {}),
                    ...(hasRequests ? {
                        requests: {
                            ...(cpuReservation ? { cpu: `${cpuReservation}m` } : {}),
                            ...(memoryReservation ? { memory: `${memoryReservation}M` } : {}),
                        }
                    } : {}),
                };
            }

            const resourceLimitsString = [
                memoryLimit ? `memory limit: ${memoryLimit}M` : null,
                memoryReservation ? `memory reservation: ${memoryReservation}M` : null,
                cpuLimit ? `CPU limit: ${cpuLimit}m` : null,
                cpuReservation ? `CPU reservation: ${cpuReservation}m` : null,
            ];
            await dlog(deploymentId, `Build scheduling: k3s native - ${resourceLimitsString.filter(Boolean).join(', ') || 'no resource limits or reservations configured'}`);
            return { resources };
        }

        if (buildNode) {
            const nodes = await clusterService.getNodeInfo();
            const targetNode = nodes.find(n => n.name === buildNode);
            if (!targetNode || !targetNode.schedulable) {
                throw new ServiceException(`Configured build node '${buildNode}' is not schedulable. Please update build settings.`);
            }

            nodeSelector = { 'kubernetes.io/hostname': buildNode };
            await dlog(deploymentId, `Build node pinned to: ${buildNode}`);
            return { nodeSelector };
        }

        try {
            const [nodeResources, nodeInfos] = await Promise.all([
                clusterService.getNodeResourceUsage(),
                clusterService.getNodeInfo(),
            ]);
            const schedulableNames = new Set(nodeInfos.filter(n => n.schedulable).map(n => n.name));
            const bestNode = nodeResources
                .filter(n => schedulableNames.has(n.name))
                .sort((a, b) => (b.ramCapacity - b.ramUsage) - (a.ramCapacity - a.ramUsage))[0];
            if (bestNode) {
                nodeSelector = { 'kubernetes.io/hostname': bestNode.name };
                await dlog(deploymentId, `Auto-selected build node with most available resources: ${bestNode.name}`);
            }
        } catch {
            await dlog(deploymentId, `Could not determine best build node, scheduling on any available node.`);
        }

        return { nodeSelector };
    }

    async deleteAllBuildsOfApp(appId: string) {
        return this.deleteAllBuildsOfWorkload(appId);
    }

    async deleteAllBuildsOfAgent(agentId: string) {
        return this.deleteAllBuildsOfWorkload(agentId);
    }

    async deleteAllBuildsOfWorkload(workloadId: string) {
        const jobNamePrefix = KubeObjectNameUtils.toJobName(workloadId);
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        const jobsOfBuild = jobs.body.items.filter((job) => job.metadata?.name?.startsWith(jobNamePrefix));
        for (const job of jobsOfBuild) {
            await this.deleteBuild(job.metadata?.name!);
        }
    }

    async deleteAllFailedOrSuccededBuilds() {
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        const jobsToDelete = jobs.body.items.filter((job) => {
            const status = this.getJobStatusString(job.status);
            return status !== 'RUNNING' && status !== 'PENDING';
        });
        for (const job of jobsToDelete) {
            await this.deleteBuild(job.metadata?.name!);
        }
    }

    async deleteAllBuildsOfProject(projectId: string) {
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        const jobsOfProject = jobs.body.items.filter((job) => job.metadata?.annotations?.[Constants.QS_ANNOTATION_PROJECT_ID] === projectId);
        for (const job of jobsOfProject) {
            await this.deleteBuild(job.metadata?.name!);
        }
    }

    async getBuildByName(buildName: string) {
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        return jobs.body.items.find((job) => job.metadata?.name === buildName);
    }

    async getAppIdByBuildName(buildName: string) {
        const job = await this.getBuildByName(buildName);
        if (!job) {
            throw new ServiceException(`No build found with name ${buildName}`);
        }
        const appId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID];
        if (!appId) {
            throw new ServiceException(`No appId found for build ${buildName}`);
        }
        return appId;
    }

    async getWorkloadByBuildName(buildName: string): Promise<{ workloadId: string; workloadType: WorkloadType }> {
        const job = await this.getBuildByName(buildName);
        if (!job) {
            throw new ServiceException(`No build found with name ${buildName}`);
        }
        const workloadType = job.metadata?.annotations?.[Constants.QS_ANNOTATION_WORKLOAD_TYPE] as WorkloadType | undefined
            ?? (job.metadata?.annotations?.[Constants.QS_ANNOTATION_AGENT_ID] ? 'agent' : 'app');
        const workloadId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_AGENT_ID]
            ?? job.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID];
        if (!workloadId) {
            throw new ServiceException(`No workloadId found for build ${buildName}`);
        }
        return { workloadId, workloadType };
    }

    async deleteBuild(buildName: string) {
        const job = await this.getBuildByName(buildName);
        const gitSshSecretName = job?.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_SSH_SECRET];
        await k3s.batch.deleteNamespacedJob(buildName, BUILD_NAMESPACE);
        await this.deleteTemporaryGitSshBuildSecret(gitSshSecretName);
        console.log(`Deleted build job ${buildName}`);
    }

    async getBuildsForApp(appId: string) {
        return this.getBuildsForWorkload(appId);
    }

    async getBuildsForAgent(agentId: string) {
        return this.getBuildsForWorkload(agentId);
    }

    async getBuildsForWorkload(workloadId: string) {
        const jobNamePrefix = KubeObjectNameUtils.toJobName(workloadId);
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        const jobsOfBuild = jobs.body.items.filter((job) => job.metadata?.name?.startsWith(jobNamePrefix));
        const builds = jobsOfBuild.map((job) => ({
            name: job.metadata?.name,
            startTime: job.status?.startTime,
            status: this.getJobStatusString(job.status),
            workloadId: workloadId,
            workloadType: (job.metadata?.annotations?.[Constants.QS_ANNOTATION_WORKLOAD_TYPE] as WorkloadType | undefined)
                ?? (job.metadata?.annotations?.[Constants.QS_ANNOTATION_AGENT_ID] ? 'agent' : 'app'),
            gitCommit: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT],
            gitCommitMessage: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE],
            deploymentId: job.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID],
            buildMethod: job.metadata?.annotations?.[Constants.QS_ANNOTATION_BUILD_METHOD] as AppBuildMethod | undefined,
        } as BuildJobModel));
        builds.sort((a, b) => {
            if (a.startTime && b.startTime) {
                return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            }
            return 0;
        });
        return builds;
    }

    async getJobStatus(buildName: string): Promise<'UNKNOWN' | 'RUNNING' | 'FAILED' | 'SUCCEEDED' | 'PENDING'> {
        try {
            const response = await k3s.batch.readNamespacedJobStatus(buildName, BUILD_NAMESPACE);
            return this.getJobStatusString(response.body.status);
        } catch (err) {
            console.error(err);
        }
        return 'UNKNOWN';
    }

    getJobStatusString(status?: V1JobStatus) {
        if (!status) {
            return 'UNKNOWN';
        }
        if ((status.ready ?? 0) > 0) {
            return 'RUNNING';
        }
        if ((status.failed ?? 0) > 0) {
            return 'FAILED';
        }
        if ((status.succeeded ?? 0) > 0) {
            return 'SUCCEEDED';
        }
        if ((status.terminating ?? 0) > 0) {
            return 'UNKNOWN';
        }
        if (status.completionTime) {
            return 'SUCCEEDED';
        }
        if ((status.active ?? 0) > 0) {
            return 'PENDING';
        }
        return 'UNKNOWN';
    }

    async getAllBuilds(): Promise<GlobalBuildJobModel[]> {
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        const appIds = Array.from(new Set(
            jobs.body.items
                .map((job) => job.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID])
                .filter((id): id is string => !!id)
        ));
        const agentIds = Array.from(new Set(
            jobs.body.items
                .map((job) => job.metadata?.annotations?.[Constants.QS_ANNOTATION_AGENT_ID])
                .filter((id): id is string => !!id)
        ));

        const [apps, agents] = await Promise.all([
            dataAccess.client.app.findMany({
                where: { id: { in: appIds } },
                include: { project: true },
            }),
            dataAccess.client.agent.findMany({
                where: { id: { in: agentIds } },
                include: { project: true },
            }),
        ]);
        const appMap = new Map(apps.map((a) => [a.id, a]));
        const agentMap = new Map(agents.map((a) => [a.id, a]));

        return jobs.body.items
            .map((job) => {
                const workloadType = (job.metadata?.annotations?.[Constants.QS_ANNOTATION_WORKLOAD_TYPE] as WorkloadType | undefined)
                    ?? (job.metadata?.annotations?.[Constants.QS_ANNOTATION_AGENT_ID] ? 'agent' : 'app');
                const workloadId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_WORKLOAD_ID]
                    ?? job.metadata?.annotations?.[workloadType === 'agent' ? Constants.QS_ANNOTATION_AGENT_ID : Constants.QS_ANNOTATION_APP_ID]
                    ?? '';
                const projectId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_PROJECT_ID];
                const workload = workloadType === 'agent'
                    ? agentMap.get(workloadId)
                    : appMap.get(workloadId);
                return {
                    name: job.metadata?.name ?? '',
                    startTime: job.status?.startTime ?? new Date(0),
                    status: this.getJobStatusString(job.status),
                    workloadId,
                    workloadType,
                    gitCommit: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT] ?? '',
                    gitCommitMessage: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE],
                    deploymentId: job.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID] ?? '',
                    projectId: projectId ?? '',
                    workloadName: workload?.name ?? workloadId ?? 'Unknown',
                    projectName: workload?.project?.name ?? projectId ?? 'Unknown',
                    completionTime: job.status?.completionTime ?? undefined,
                    buildMethod: job.metadata?.annotations?.[Constants.QS_ANNOTATION_BUILD_METHOD] as AppBuildMethod | undefined,
                } as GlobalBuildJobModel;
            })
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }

    private createTemporaryGitSshBuildSecret(workloadType: WorkloadType, workloadId: string, buildName: string) {
        return workloadType === 'agent'
            ? agentGitSshKeyService.createTemporaryBuildSecret(workloadId, buildName)
            : appGitSshKeyService.createTemporaryBuildSecret(workloadId, buildName);
    }

    private async deleteTemporaryGitSshBuildSecret(secretName?: string) {
        await appGitSshKeyService.deleteTemporaryBuildSecret(secretName);
    }
}

const buildService = new BuildService();
export default buildService;
