import * as k8s from '@kubernetes/client-node';
import { V1Job } from '@kubernetes/client-node';
import { Constants } from '../../../shared/utils/constants';
import k3s from '../../adapter/kubernetes-api.adapter';
import buildService from '../build.service';
import deploymentService from '../deployment.service';
import appService from '../app.service';
import { dlog } from '../deployment-logs.service';
import { BUILD_NAMESPACE } from '../registry.service';
import { AppBuildMethod } from '@/shared/model/app-source-info.model';

declare global {
    var buildWatchServiceInstance: BuildWatchService | undefined;
}

class BuildWatchService {
    private isWatchRunning = false;
    private processedJobs = new Set<string>();

    async startWatch() {
        if (this.isWatchRunning) {
            console.log('[BuildWatch] Watch already running, skipping start.');
            return;
        }
        this.isWatchRunning = true;
        console.log('[BuildWatch] Starting build job watch...');

        await this.scanExistingJobs();

        const kc = k3s.getKubeConfig();
        const watch = new k8s.Watch(kc);

        await watch.watch(
            `/apis/batch/v1/namespaces/${BUILD_NAMESPACE}/jobs`,
            {},
            async (type: string, apiObj: unknown) => {
                try {
                    const job = apiObj as V1Job;
                    await this.handleJobEvent(job);
                } catch (e) {
                    console.error('[BuildWatch] Error handling job event:', e);
                }
            },
            (err: unknown) => {
                if (err) console.error('[BuildWatch] Watch error:', err);
                console.log('[BuildWatch] Watch ended, restarting in 5s...');
                this.isWatchRunning = false;
                setTimeout(() => this.startWatch(), 5000);
            }
        );
    }

    private async scanExistingJobs() {
        console.log('[BuildWatch] Scanning existing build jobs...');
        try {
            const jobs = await k3s.batch.listNamespacedJob(BUILD_NAMESPACE);
            for (const job of jobs.body.items) {
                const jobName = job.metadata?.name;
                if (!jobName) continue;

                const status = buildService.getJobStatusString(job.status);

                if (status === 'FAILED') {
                    // Mark as processed so watch won't re-handle it
                    this.processedJobs.add(jobName);
                    continue;
                }

                if (status === 'SUCCEEDED') {
                    // Check if deployment already reflects this build via git commit comparison
                    const appId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID];
                    const projectId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_PROJECT_ID];
                    const jobGitCommit = job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT];

                    if (!appId || !projectId) {
                        this.processedJobs.add(jobName);
                        continue;
                    }

                    try {
                        const deployment = await deploymentService.getDeployment(projectId, appId);
                        const deployedGitCommit = deployment?.spec?.template?.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT];

                        if (jobGitCommit && deployedGitCommit && jobGitCommit === deployedGitCommit) {
                            // Already deployed with this commit
                            this.processedJobs.add(jobName);
                            console.log(`[BuildWatch] Job ${jobName} already deployed (commit=${jobGitCommit}), skipping.`);
                        } else {
                            // Not yet deployed — trigger deployment
                            this.processedJobs.add(jobName);
                            console.log(`[BuildWatch] Job ${jobName} not yet deployed, triggering deployment.`);
                            await this.handleSucceeded(job);
                        }
                    } catch (e) {
                        console.error(`[BuildWatch] Error checking deployment for app ${appId}:`, e);
                        this.processedJobs.add(jobName);
                    }
                }
            }
        } catch (e) {
            console.error('[BuildWatch] Error during startup scan:', e);
        }
        console.log('[BuildWatch] Startup scan complete.');
    }

    private async handleJobEvent(job: V1Job) {
        const jobName = job.metadata?.name;
        if (!jobName || this.processedJobs.has(jobName)) return;

        const status = buildService.getJobStatusString(job.status);

        if (status === 'SUCCEEDED') {
            this.processedJobs.add(jobName);
            await this.handleSucceeded(job);
        } else if (status === 'FAILED') {
            this.processedJobs.add(jobName);
            await this.handleFailed(job);
        }
    }

    private async handleSucceeded(job: V1Job) {
        const deploymentId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID];
        const appId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID];
        const gitCommitHash = job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT];
        const gitCommitMessage = job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE];
        const buildJobName = job.metadata?.name;
        const buildMethod = job.metadata?.annotations?.[Constants.QS_ANNOTATION_BUILD_METHOD] as AppBuildMethod | undefined;

        if (!deploymentId || !appId || !buildJobName) {
            console.error('[BuildWatch] handleSucceeded: missing required annotations on job', job.metadata?.name);
            return;
        }

        try {
            console.log(`[BuildWatch] Build job ${buildJobName} succeeded, triggering deployment for app ${appId}`);
            await dlog(deploymentId, `*************************************`);
            await dlog(deploymentId, ` ✓ Build job completed successfully. `);
            await dlog(deploymentId, `*************************************`);
            await dlog(deploymentId, `Starting deployment with output from build "${buildJobName}"`);
            const app = await appService.getExtendedById(appId, false);
            await deploymentService.createDeployment(
                deploymentId,
                app,
                buildJobName,
                gitCommitHash,
                gitCommitMessage,
                buildMethod ?? (app.buildMethod === 'DOCKERFILE' ? 'DOCKERFILE' : 'RAILPACK'),
            );
        } catch (e) {
            console.error(`[BuildWatch] Error triggering deployment for app ${appId}:`, e);
            if (deploymentId) {
                await dlog(deploymentId, `[ERROR] Deployment failed after build: ${e}`);
            }
        }
    }

    private async handleFailed(job: V1Job) {
        const deploymentId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID];
        const buildJobName = job.metadata?.name;
        if (!deploymentId) return;

        console.log(`[BuildWatch] Build job ${buildJobName} failed, logging error.`);
        await dlog(deploymentId, `*********************`);
        await dlog(deploymentId, ` ⚠ Build job failed. `);
        await dlog(deploymentId, `*********************`);
    }
}

const buildWatchService = globalThis.buildWatchServiceInstance ?? new BuildWatchService();
globalThis.buildWatchServiceInstance = buildWatchService;
export default buildWatchService;
