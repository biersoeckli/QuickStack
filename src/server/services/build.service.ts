import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Job, V1JobStatus, V1ResourceRequirements } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { BuildJobModel } from "@/shared/model/build-job";
import { GlobalBuildJobModel } from "@/shared/model/global-build-job.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import dataAccess from "../adapter/db.client";
import { PodsInfoModel } from "@/shared/model/pods-info.model";
import namespaceService from "./namespace.service";
import { Constants } from "../../shared/utils/constants";
import gitService from "./git.service";
import { dlog } from "./deployment-logs.service";
import podService from "./pod.service";
import stream from "stream";
import { PathUtils } from "../utils/path.utils";
import registryService, { BUILD_NAMESPACE } from "./registry.service";
import paramService, { ParamService } from "./param.service";
import clusterService from "./cluster.service";
import buildInitContainerService from "./build-init-container.service";

const buildkitImage = "moby/buildkit:master";

class BuildService {


    async buildApp(deploymentId: string, app: AppExtendedModel, forceBuild: boolean = false): Promise<[string, string, string, boolean]> {
        await namespaceService.createNamespaceIfNotExists(BUILD_NAMESPACE);
        const registryLocation = await paramService.getString(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION);
        await registryService.deployRegistry(registryLocation!);
        const buildsForApp = await this.getBuildsForApp(app.id);
        if (buildsForApp.some((job) => job.status === 'RUNNING')) {
            throw new ServiceException("A build job is already running for this app.");
        }

        dlog(deploymentId, `Initialized app build...`);
        dlog(deploymentId, `Trying to clone repository...`);

        // Check if last build is already up to date with data in git repo
        const latestSuccessfulBuld = buildsForApp.find(x => x.status === 'SUCCEEDED');
        const { latestRemoteGitHash, latestRemoteGitCommitMessage } = await gitService.openGitContext(app, async (ctx) => {
            await ctx.checkIfDockerfileExists();
            const [hash, message] = await Promise.all([
                ctx.getLatestRemoteCommitHash(),
                ctx.getLatestRemoteCommitMessage(),
            ]);
            return { latestRemoteGitHash: hash, latestRemoteGitCommitMessage: message };
        });

        dlog(deploymentId, `Cloned repository successfully`);
        dlog(deploymentId, `Latest remote git hash: ${latestRemoteGitHash}`);

        if (!forceBuild && latestSuccessfulBuld?.gitCommit && latestRemoteGitHash &&
            latestSuccessfulBuld?.gitCommit === latestRemoteGitHash) {

            if (await registryService.doesImageExist(app.id, 'latest')) {
                await dlog(deploymentId, `Latest build is already up to date with git repository, using container from last build.`);
                return [latestSuccessfulBuld.name, latestRemoteGitHash, latestRemoteGitCommitMessage, true];
            } else {
                await dlog(deploymentId, `Docker Image for last build not found in internal registry, creating new build.`);
            }
        }
        return await this.createAndStartBuildJob(deploymentId, app, latestRemoteGitHash, latestRemoteGitCommitMessage);
    }

    private async createAndStartBuildJob(deploymentId: string, app: AppExtendedModel, latestRemoteGitHash: string, latestRemoteGitCommitMessage: string = ''): Promise<[string, string, string, boolean]> {

        const buildName = KubeObjectNameUtils.addRandomSuffix(KubeObjectNameUtils.toJobName(app.id));

        dlog(deploymentId, `Creating build job with name: ${buildName}`);

        await buildInitContainerService.ensureRbacResources();
        const queuedAt = Date.now().toString();
        const initContainer = buildInitContainerService.getInitContainer(buildName, queuedAt);

        const contextPaths = PathUtils.splitPath(app.dockerfilePath);

        // Prepare Git URL with authentication if needed
        let gitContextUrl = `${app.gitUrl!}#refs/heads/${app.gitBranch}${contextPaths.folderPath ? ':' + contextPaths.folderPath : ''}`;
        if (app.gitUsername && app.gitToken) {
            const authenticatedGitUrl = app.gitUrl!.replace('https://', `https://${app.gitUsername}:${app.gitToken}@`);
            gitContextUrl = `${authenticatedGitUrl}#refs/heads/${app.gitBranch}${contextPaths.folderPath ? ':' + contextPaths.folderPath : ''}`;
        }

        // BuildKit arguments for buildctl-daemonless.sh
        const buildkitArgs = [
            "build",
            "--frontend",
            "dockerfile.v0",
            "--opt",
            `filename=${contextPaths.filePath}`,
            "--opt",
            `context=${gitContextUrl}`,
            "--output",
            `type=image,name=${registryService.createInternalContainerRegistryUrlForAppId(app.id)},push=true,registry.insecure=true`
        ];

        dlog(deploymentId, `Dockerfile context path: ${contextPaths.folderPath ?? 'root directory of Git Repository'}. Dockerfile name: ${contextPaths.filePath}`);

        // Read global build settings
        const buildNode = await paramService.getString(ParamService.BUILD_NODE);

        // Determine node selector and resource limits based on build node setting
        let nodeSelector: Record<string, string> | undefined;
        let resources: V1ResourceRequirements | undefined;

        if (buildNode === Constants.BUILD_NODE_K3S_NATIVE_VALUE) {
            // k3s native: let k3s schedule based on resource limits, no nodeSelector
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
            ]
            dlog(deploymentId, `Build scheduling: k3s native - ${resourceLimitsString.filter(s => !!s).join(', ') || 'no resource limits or reservations configured'}`);
        } else if (buildNode) {
            // specific node pinned
            const nodes = await clusterService.getNodeInfo();
            const targetNode = nodes.find(n => n.name === buildNode);
            if (!targetNode || !targetNode.schedulable) {
                throw new ServiceException(
                    `Configured build node '${buildNode}' is not schedulable. Please update build settings.`
                );
            }
            nodeSelector = { 'kubernetes.io/hostname': buildNode };
            dlog(deploymentId, `Build node pinned to: ${buildNode}`);
        } else {
            // auto: pick node with most available RAM
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
                    dlog(deploymentId, `Auto-selected build node with most available resources: ${bestNode.name}`);
                }
            } catch {
                dlog(deploymentId, `Could not determine best build node, scheduling on any available node.`);
            }
        }

        const jobDefinition: V1Job = {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
                name: buildName,
                namespace: BUILD_NAMESPACE,
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: app.id,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
                    [Constants.QS_ANNOTATION_GIT_COMMIT]: latestRemoteGitHash,
                    [Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE]: latestRemoteGitCommitMessage.substring(0, 200), // truncate to avoid exceeding 256 KiB size limits of annotations object.
                    [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: deploymentId,
                    [Constants.QS_ANNOTATION_BUILD_QUEUED_AT]: queuedAt,
                }
            },
            spec: {
                ttlSecondsAfterFinished: 86400, // 1 day
                template: {
                    spec: {
                        // Depends on feature gate UserNamespacesSupport (available in k8s 1.25+)
                        hostUsers: false,
                        serviceAccountName: 'qs-build-watcher',
                        initContainers: [initContainer],
                        ...(nodeSelector ? { nodeSelector } : {}),
                        containers: [
                            {
                                name: buildName,
                                image: buildkitImage,
                                command: ["buildctl-daemonless.sh"],
                                args: buildkitArgs,
                                securityContext: {
                                    privileged: true
                                },
                                ...(resources ? { resources } : {}),
                            },
                        ],
                        restartPolicy: "Never",

                    },
                },
                backoffLimit: 0,
            },
        };
        await k3s.batch.createNamespacedJob(BUILD_NAMESPACE, jobDefinition);

        await dlog(deploymentId, `Build job ${buildName} started successfully`);

        await new Promise(resolve => setTimeout(resolve, 2000)); // wait to be sure that pod is created
        this.logBuildOutput(deploymentId, buildName).catch((err) => {
            dlog(deploymentId, `An error occurred while loading build logs: ${err instanceof Error ? err.message : String(err)}`);
            console.error(`Error while streaming build logs for build ${buildName}:`, err);
        });

        return [buildName, latestRemoteGitHash, latestRemoteGitCommitMessage, false];
    }

    async logBuildOutput(deploymentId: string, buildName: string) {

        const pod = await this.getPodForJob(buildName);
        await podService.waitUntilPodIsRunningFailedOrSucceded(BUILD_NAMESPACE, pod.podName);

        const logStream = new stream.PassThrough();

        const k3sStreamRequest = await k3s.log.log(BUILD_NAMESPACE, pod.podName, pod.containerName, logStream, {
            follow: true,
            tailLines: undefined,
            timestamps: true,
            pretty: false,
            previous: false
        });

        logStream.on('data', async (chunk) => {
            await dlog(deploymentId, chunk.toString(), false, false);
        });

        logStream.on('error', async (error) => {
            console.error("Error in build log stream for deployment " + deploymentId, error);
            await dlog(deploymentId, '[ERROR] An unexpected error occurred while streaming logs.');
        });

        logStream.on('end', async () => {
            console.log(`[END] Log stream ended for build process: ${buildName}`);
            await dlog(deploymentId, `[END] Log stream ended for build process: ${buildName}`);
        });
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
            return !status || status !== 'RUNNING';
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
        const builds = jobsOfBuild.map((job) => {
            return {
                name: job.metadata?.name,
                startTime: job.status?.startTime,
                status: this.getJobStatusString(job.status),
                gitCommit: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT],
                gitCommitMessage: job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE],
                deploymentId: job.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID],
            } as BuildJobModel;
        });
        builds.sort((a, b) => {
            if (a.startTime && b.startTime) {
                return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            }
            return 0;
        });
        return builds;
    }


    async getPodForJob(jobName: string) {
        const res = await k3s.core.listNamespacedPod(BUILD_NAMESPACE, undefined, undefined, undefined, undefined, `job-name=${jobName}`);
        const jobs = res.body.items;
        if (jobs.length === 0) {
            throw new ServiceException(`No pod found for job ${jobName}`);
        }
        const pod = jobs[0];
        return {
            podName: pod.metadata?.name!,
            containerName: pod.spec?.containers?.[0].name!
        } as PodsInfoModel;
    }

    async waitForJobCompletion(jobName: string, deploymentId: string) {
        const POLL_INTERVAL = 10000; // 10 seconds
        return await new Promise<void>((resolve, reject) => {
            const intervalId = setInterval(async () => {
                try {
                    const jobStatus = await this.getJobStatus(jobName);
                    if (jobStatus === 'UNKNOWN') {
                        console.log(`Job ${jobName} not found.`);
                        clearInterval(intervalId);
                        dlog(deploymentId, `***********************************`);
                        dlog(deploymentId, ` ⚠ Build job ${jobName} not found.`);
                        dlog(deploymentId, ` It might have been deleted manually or due to a cleanup process.`);
                        dlog(deploymentId, `***********************************`);
                        reject(new Error(`Job ${jobName} not found.`));
                        return;
                    }
                    if (jobStatus === 'SUCCEEDED') {
                        clearInterval(intervalId);
                        console.log(`Job ${jobName} completed successfully.`);
                        dlog(deploymentId, `*************************************`);
                        dlog(deploymentId, ` ✓ Build job completed successfully. `);
                        dlog(deploymentId, `*************************************`);
                        resolve();
                    } else if (jobStatus === 'FAILED') {
                        clearInterval(intervalId);
                        console.log(`Job ${jobName} failed.`);
                        dlog(deploymentId, `*********************`);
                        dlog(deploymentId, ` ⚠ Build job failed. `);
                        dlog(deploymentId, `*********************`);
                        reject(new Error(`Job ${jobName} failed.`));
                    } else {
                        console.log(`Job ${jobName} is still running...`);
                    }
                } catch (err) {
                    clearInterval(intervalId);
                    reject(err);
                }
            }, POLL_INTERVAL);
        });
    }

    async getJobStatus(buildName: string): Promise<'UNKNOWN' | 'RUNNING' | 'FAILED' | 'SUCCEEDED' | 'PENDING'> {
        try {
            const response = await k3s.batch.readNamespacedJobStatus(buildName, BUILD_NAMESPACE);
            const status = response.body.status;
            return this.getJobStatusString(status);
        } catch (err) {
            console.error(err);
        }
        return 'UNKNOWN';
    }

    getJobStatusString(status?: V1JobStatus) {
        if (!status) {
            return 'UNKNOWN';
        }
        if (status.ready ?? 0 > 0) {
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
        if (!!status.completionTime) {
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

        const builds: GlobalBuildJobModel[] = jobs.body.items
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
                } as GlobalBuildJobModel;
            })
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        return builds;
    }
}

const buildService = new BuildService();
export default buildService;
