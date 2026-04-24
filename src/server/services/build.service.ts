import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { BuildJobModel } from "@/shared/model/build-job";
import { GlobalBuildJobModel } from "@/shared/model/global-build-job.model";
import { PodsInfoModel } from "@/shared/model/pods-info.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "../../shared/utils/constants";
import dataAccess from "../adapter/db.client";
import k3s from "../adapter/kubernetes-api.adapter";
import buildInitContainerService from "./build-job-builders/build-init-container.service";
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

class BuildService {

    async buildApp(deploymentId: string, app: AppExtendedModel, forceBuild: boolean = false): Promise<[string, string, string, boolean]> {
        await namespaceService.createNamespaceIfNotExists(BUILD_NAMESPACE);
        const registryLocation = await paramService.getString(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION);
        await registryService.deployRegistry(registryLocation!);

        const buildsForApp = await this.getBuildsForApp(app.id);
        if (buildsForApp.some((job) => job.status === 'RUNNING' || job.status === 'PENDING')) {
            throw new ServiceException("A build job is already running for this app.");
        }

        const buildMethod = this.getBuildMethod(app);
        await dlog(deploymentId, `Initialized app build...`);
        await dlog(deploymentId, `Selected build method: ${buildMethod}`);
        await dlog(deploymentId, `Trying to clone repository...`);

        const latestSuccessfulBuld = buildsForApp.find(x => x.status === 'SUCCEEDED');
        const { latestRemoteGitHash, latestRemoteGitCommitMessage } = await gitService.openGitContext(app, async (ctx) => {
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

        if (!forceBuild && latestSuccessfulBuld?.gitCommit && latestRemoteGitHash &&
            latestSuccessfulBuld.gitCommit === latestRemoteGitHash) {
            if (await registryService.doesImageExist(app.id, 'latest')) {
                await dlog(deploymentId, `Latest build is already up to date with git repository, using container from last build.`);
                return [latestSuccessfulBuld.name, latestRemoteGitHash, latestRemoteGitCommitMessage, true];
            }

            await dlog(deploymentId, `Docker Image for last build not found in internal registry, creating new build.`);
        }

        return this.createAndStartBuildJob(deploymentId, app, latestRemoteGitHash, latestRemoteGitCommitMessage);
    }

    private async createAndStartBuildJob(
        deploymentId: string,
        app: AppExtendedModel,
        latestRemoteGitHash: string,
        latestRemoteGitCommitMessage: string = '',
    ): Promise<[string, string, string, boolean]> {
        const buildName = KubeObjectNameUtils.addRandomSuffix(KubeObjectNameUtils.toJobName(app.id));
        const buildMethod = this.getBuildMethod(app);
        const builder = this.getBuilder(buildMethod);

        await dlog(deploymentId, `Creating build job with name: ${buildName}`);
        await buildInitContainerService.ensureRbacResources();

        if (buildMethod === 'DOCKERFILE') {
            await dlog(deploymentId, `Dockerfile path: ${app.dockerfilePath || './Dockerfile'}`);
        } else {
            await dlog(deploymentId, `Railpack build will run queue wait, prepare step, and BuildKit build in sequence.`);
        }

        const queuedAt = Date.now().toString();
        const schedulingConfig = await this.getBuildSchedulingConfig(deploymentId);
        const jobDefinition = await builder.buildJobDefinition({
            app,
            buildName,
            deploymentId,
            latestRemoteGitHash,
            latestRemoteGitCommitMessage,
            queuedAt,
            ...schedulingConfig,
        });

        await k3s.batch.createNamespacedJob(BUILD_NAMESPACE, jobDefinition);
        await dlog(deploymentId, `Build job ${buildName} scheduled successfully`);

        return [buildName, latestRemoteGitHash, latestRemoteGitCommitMessage, false];
    }

    private getBuildMethod(app: AppExtendedModel): AppBuildMethod {
        return app.buildMethod === 'DOCKERFILE' ? 'DOCKERFILE' : 'RAILPACK';
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
        const jobNamePrefix = KubeObjectNameUtils.toJobName(appId);
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

    async deleteBuild(buildName: string) {
        await k3s.batch.deleteNamespacedJob(buildName, BUILD_NAMESPACE);
        console.log(`Deleted build job ${buildName}`);
    }

    async getBuildsForApp(appId: string) {
        const jobNamePrefix = KubeObjectNameUtils.toJobName(appId);
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        const jobsOfBuild = jobs.body.items.filter((job) => job.metadata?.name?.startsWith(jobNamePrefix));
        const builds = jobsOfBuild.map((job) => ({
            name: job.metadata?.name,
            startTime: job.status?.startTime,
            status: this.getJobStatusString(job.status),
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

        const apps = await dataAccess.client.app.findMany({
            where: { id: { in: appIds } },
            include: { project: true },
        });
        const appMap = new Map(apps.map((a) => [a.id, a]));

        return jobs.body.items
            .map((job) => {
                const appId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID];
                const projectId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_PROJECT_ID];
                const app = appId ? appMap.get(appId) : undefined;
                return {
                    name: job.metadata?.name ?? '',
                    startTime: job.status?.startTime ?? new Date(0),
                    status: this.getJobStatusString(job.status),
                    gitCommit: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT] ?? '',
                    gitCommitMessage: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE],
                    deploymentId: job.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID] ?? '',
                    appId: appId ?? '',
                    projectId: projectId ?? '',
                    appName: app?.name ?? appId ?? 'Unknown',
                    projectName: app?.project?.name ?? projectId ?? 'Unknown',
                    completionTime: job.status?.completionTime ?? undefined,
                    buildMethod: job.metadata?.annotations?.[Constants.QS_ANNOTATION_BUILD_METHOD] as AppBuildMethod | undefined,
                } as GlobalBuildJobModel;
            })
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
}

const buildService = new BuildService();
export default buildService;
