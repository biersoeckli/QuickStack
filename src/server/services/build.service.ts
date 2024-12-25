import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Job, V1JobStatus } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { BuildJobModel } from "@/shared/model/build-job";
import { ServiceException } from "@/shared/model/service.exception.model";
import { PodsInfoModel } from "@/shared/model/pods-info.model";
import namespaceService from "./namespace.service";
import { Constants } from "../../shared/utils/constants";
import gitService from "./git.service";
import { dlog } from "./deployment-logs.service";
import podService from "./pod.service";
import stream from "stream";
import { PathUtils } from "../utils/path.utils";
import registryService, { BUILD_NAMESPACE } from "./registry.service";

const kanikoImage = "gcr.io/kaniko-project/executor:latest";

class BuildService {


    async buildApp(deploymentId: string, app: AppExtendedModel, forceBuild: boolean = false): Promise<[string, string, Promise<void>]> {
        await namespaceService.createNamespaceIfNotExists(BUILD_NAMESPACE);
        await registryService.deployRegistry();
        const buildsForApp = await this.getBuildsForApp(app.id);
        if (buildsForApp.some((job) => job.status === 'RUNNING')) {
            throw new ServiceException("A build job is already running for this app.");
        }

        dlog(deploymentId, `Initialized app build...`);
        dlog(deploymentId, `Trying to clone repository...`);

        // Check if last build is already up to date with data in git repo
        const latestSuccessfulBuld = buildsForApp.find(x => x.status === 'SUCCEEDED');
        const latestRemoteGitHash = await gitService.openGitContext(app, async (ctx) => {
            await ctx.checkIfDockerfileExists();
            return await ctx.getLatestRemoteCommitHash();
        });

        dlog(deploymentId, `Cloned repository successfully`);
        dlog(deploymentId, `Latest remote git hash: ${latestRemoteGitHash}`);

        if (!forceBuild && latestSuccessfulBuld?.gitCommit && latestRemoteGitHash &&
            latestSuccessfulBuld?.gitCommit === latestRemoteGitHash) {

            if (await registryService.doesImageExist(app.id, 'latest')) {
                await dlog(deploymentId, `Latest build is already up to date with git repository, using container from last build.`);
                return [latestSuccessfulBuld.name, latestRemoteGitHash, Promise.resolve()];
            } else {
                await dlog(deploymentId, `Docker Image for last build not found in internal registry, creating new build.`);
            }
        }
        return await this.createAndStartBuildJob(deploymentId, app, latestRemoteGitHash);
    }

    private async createAndStartBuildJob(deploymentId: string, app: AppExtendedModel, latestRemoteGitHash: string): Promise<[string, string, Promise<void>]> {

        const buildName = KubeObjectNameUtils.addRandomSuffix(KubeObjectNameUtils.toJobName(app.id));

        dlog(deploymentId, `Creating build job with name: ${buildName}`);

        const contextPaths = PathUtils.splitPath(app.dockerfilePath);

        const kanikoArgs = [
            `--dockerfile=${contextPaths.filePath}`,
            `--insecure`,
            `--log-format=text`,
            `--context=${app.gitUrl!.replace("https://", "git://")}#refs/heads/${app.gitBranch}`,
            `--destination=${registryService.createInternalContainerRegistryUrlForAppId(app.id)}`
        ];

        if (contextPaths.folderPath) {
            kanikoArgs.push(`--context-sub-path=${contextPaths.folderPath}`);
        }

        dlog(deploymentId, `Dockerfile context path: ${contextPaths.folderPath ?? 'root directory of Git Repository'}. Dockerfile name: ${contextPaths.filePath}`);

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
                    [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: deploymentId,
                }
            },
            spec: {
                ttlSecondsAfterFinished: 2592000, // 30 days
                template: {
                    spec: {
                        containers: [
                            {
                                name: buildName,
                                image: kanikoImage,
                                args: kanikoArgs
                            },
                        ],
                        restartPolicy: "Never",

                    },
                },
                backoffLimit: 0,
            },
        };
        if (app.gitUsername && app.gitToken) {
            jobDefinition.spec!.template.spec!.containers[0].env = [
                {
                    name: "GIT_USERNAME",
                    value: app.gitUsername
                },
                {
                    name: "GIT_PASSWORD",
                    value: app.gitToken
                }
            ];
        }
        await k3s.batch.createNamespacedJob(BUILD_NAMESPACE, jobDefinition);

        await dlog(deploymentId, `Build job ${buildName} started successfully`);

        await new Promise(resolve => setTimeout(resolve, 5000)); // wait to be sure that pod is created
        await this.logBuildOutput(deploymentId, buildName);

        const buildJobPromise = this.waitForJobCompletion(jobDefinition.metadata!.name!)

        return [buildName, latestRemoteGitHash, buildJobPromise];
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

    async deleteAllBuildsOfProject(projectId: string) {
        const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
        const jobsOfProject = jobs.body.items.filter((job) => job.metadata?.annotations?.[Constants.QS_ANNOTATION_PROJECT_ID] === projectId);
        for (const job of jobsOfProject) {
            await this.deleteBuild(job.metadata?.name!);
        }
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

    async waitForJobCompletion(jobName: string) {
        const POLL_INTERVAL = 10000; // 10 seconds
        return await new Promise<void>((resolve, reject) => {
            const intervalId = setInterval(async () => {
                try {
                    const jobStatus = await this.getJobStatus(jobName);
                    if (jobStatus === 'UNKNOWN') {
                        console.log(`Job ${jobName} not found.`);
                        clearInterval(intervalId);
                        reject(new Error(`Job ${jobName} not found.`));
                        return;
                    }
                    if (jobStatus === 'SUCCEEDED') {
                        clearInterval(intervalId);
                        console.log(`Job ${jobName} completed successfully.`);
                        resolve();
                    } else if (jobStatus === 'FAILED') {
                        clearInterval(intervalId);
                        console.log(`Job ${jobName} failed.`);
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

    async getJobStatus(buildName: string): Promise<'UNKNOWN' | 'RUNNING' | 'FAILED' | 'SUCCEEDED'> {
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
        if ((status.active ?? 0) > 0) {
            return 'RUNNING';
        }
        if ((status.succeeded ?? 0) > 0) {
            return 'SUCCEEDED';
        }

        if ((status.failed ?? 0) > 0) {
            return 'FAILED';
        }
        return 'UNKNOWN';
    }
}

const buildService = new BuildService();
export default buildService;
