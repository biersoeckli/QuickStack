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
import appGitSshKeyService from '../app-git-ssh-key.service';

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

            // Group successful jobs by appId so we only deploy the newest per app.
            // Without this, multiple successful jobs for the same app trigger
            // sequential deployments in alphabetical order, causing the last-processed
            // (often older) job to "win" and roll back the deployment.
            const succeededByApp = new Map<string, V1Job[]>();

            for (const job of jobs.body.items) {
                const jobName = job.metadata?.name;
                if (!jobName) continue;

                const status = buildService.getJobStatusString(job.status);

                if (status === 'FAILED') {
                    this.processedJobs.add(jobName);
                    continue;
                }

                if (status === 'SUCCEEDED') {
                    const appId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID];
                    const projectId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_PROJECT_ID];

                    if (!appId || !projectId) {
                        this.processedJobs.add(jobName);
                        continue;
                    }

                    const existing = succeededByApp.get(appId);
                    if (existing) {
                        existing.push(job);
                    } else {
                        succeededByApp.set(appId, [job]);
                    }
                }
            }

            // For each app, pick the newest successful job (by creationTimestamp)
            // and only trigger deployment for that one.
            succeededByApp.forEach(async (appJobs, appId) => {
                // Sort descending by creationTime: newest first
                appJobs.sort((a, b) => {
                    const timeA = a.metadata?.creationTimestamp
                        ? new Date(a.metadata.creationTimestamp).getTime()
                        : 0;
                    const timeB = b.metadata?.creationTimestamp
                        ? new Date(b.metadata.creationTimestamp).getTime()
                        : 0;
                    return timeB - timeA;
                });

                const newestJob = appJobs[0];
                const jobName = newestJob.metadata?.name;
                if (!jobName) return;

                const projectId = newestJob.metadata?.annotations?.[Constants.QS_ANNOTATION_PROJECT_ID];
                const jobGitCommit = newestJob.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT];

                try {
                    const deployment = await deploymentService.getDeployment(projectId!, appId);
                    const deployedGitCommit = deployment?.spec?.template?.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT];

                    if (jobGitCommit && deployedGitCommit && jobGitCommit === deployedGitCommit) {
                        console.log(`[BuildWatch] Job ${jobName} already deployed (commit=${jobGitCommit}), skipping.`);
                    } else {
                        console.log(`[BuildWatch] Job ${jobName} not yet deployed (newest of ${appJobs.length} job(s) for this app), triggering deployment.`);
                        await this.handleSucceeded(newestJob);
                    }
                } catch (e) {
                    console.error(`[BuildWatch] Error checking deployment for app ${appId}:`, e);
                }

                // Mark all jobs for this app as processed so the watch won't re-handle them
                for (const job of appJobs) {
                    const name = job.metadata?.name;
                    if (name) this.processedJobs.add(name);
                }
            });
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
        const gitSshSecretName = job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_SSH_SECRET];

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
        } finally {
            await appGitSshKeyService.deleteTemporaryBuildSecret(gitSshSecretName);
        }
    }

    private async handleFailed(job: V1Job) {
        const deploymentId = job.metadata?.annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID];
        const buildJobName = job.metadata?.name;
        const gitSshSecretName = job.metadata?.annotations?.[Constants.QS_ANNOTATION_GIT_SSH_SECRET];
        if (!deploymentId) {
            await appGitSshKeyService.deleteTemporaryBuildSecret(gitSshSecretName);
            return;
        }

        console.log(`[BuildWatch] Build job ${buildJobName} failed, logging error.`);
        await dlog(deploymentId, `*********************`);
        await dlog(deploymentId, ` ⚠ Build job failed. `);
        await dlog(deploymentId, `*********************`);
        await appGitSshKeyService.deleteTemporaryBuildSecret(gitSshSecretName);
    }
}

const buildWatchService = globalThis.buildWatchServiceInstance ?? new BuildWatchService();
globalThis.buildWatchServiceInstance = buildWatchService;
export default buildWatchService;
