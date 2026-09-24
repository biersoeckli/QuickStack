import { V1Job } from '@kubernetes/client-node';
import { AppBuildMethod } from '../../../shared/model/app-source-info.model';
import { AppBuildStatusModel, isActiveBuildStatus } from '../../../shared/model/app-build-status.model';
import { BuildJobModel } from '../../../shared/model/build-job';
import { GlobalBuildJobModel } from '../../../shared/model/global-build-job.model';
import { WorkloadType } from '../../../shared/model/runtime-type.model';
import { Constants } from '../../../shared/utils/constants';
import buildService from '../build.service';

export type BuildStatusListener = (status: AppBuildStatusModel) => void | Promise<void>;

type ReconcilableBuild = BuildJobModel & Partial<Pick<GlobalBuildJobModel, 'workloadName' | 'projectName' | 'projectId' | 'completionTime'>>;

declare global {
    var buildStatusServiceInstance: BuildStatusPubSubService | undefined;
}

/**
 * In-memory, process-wide cache of the latest build status per workload.
 *
 * The Kubernetes job watch feeds this service through `applyJobEvent`, and the
 * SSE route subscribes to receive status transitions. The cache is not the
 * source of truth: `ensureSeeded` builds it from the build service, so a restart
 * or reconnect behaves the same as a long-running process.
 */
class BuildStatusPubSubService {
    private statuses = new Map<string, AppBuildStatusModel>();
    private subscribers = new Set<BuildStatusListener>();
    private seedPromise: Promise<void> | null = null;

    subscribe(listener: BuildStatusListener): () => void {
        this.subscribers.add(listener);
        let isSubscribed = true;
        return () => {
            if (!isSubscribed) {
                return;
            }
            isSubscribed = false;
            this.subscribers.delete(listener);
        };
    }

    getStatuses(): AppBuildStatusModel[] {
        return Array.from(this.statuses.values());
    }

    getStatus(workloadType: WorkloadType, workloadId: string): AppBuildStatusModel | undefined {
        return this.statuses.get(this.key(workloadType, workloadId));
    }

    /** Rebuilds the cached status for every workload present in the given builds. */
    applyBuildJobs(builds: ReconcilableBuild[]): void {
        const groups = new Map<string, { workloadType: WorkloadType; workloadId: string; builds: ReconcilableBuild[] }>();
        for (const build of builds) {
            if (!build.workloadId || !build.workloadType) {
                continue;
            }
            const groupKey = this.key(build.workloadType, build.workloadId);
            const group = groups.get(groupKey) ?? { workloadType: build.workloadType, workloadId: build.workloadId, builds: [] };
            group.builds.push(build);
            groups.set(groupKey, group);
        }

        for (const group of groups.values()) {
            this.reconcileGroup(group.workloadType, group.workloadId, group.builds);
        }
    }

    /**
     * Applies a single Kubernetes job watch event.
     *
     * ADDED/MODIFIED upsert the workload status. DELETED re-reads the remaining
     * builds for that workload because a single deleted job does not tell us the
     * previous build's outcome.
     */
    async applyJobEvent(type: string, job: V1Job): Promise<void> {
        const annotations = job.metadata?.annotations;
        const buildName = job.metadata?.name;
        const workloadType = (annotations?.[Constants.QS_ANNOTATION_WORKLOAD_TYPE] as WorkloadType | undefined)
            ?? (annotations?.[Constants.QS_ANNOTATION_AGENT_ID] ? 'agent' : 'app');
        const workloadId = annotations?.[Constants.QS_ANNOTATION_WORKLOAD_ID]
            ?? annotations?.[workloadType === 'agent' ? Constants.QS_ANNOTATION_AGENT_ID : Constants.QS_ANNOTATION_APP_ID];
        if (!workloadId) {
            return;
        }

        if (type === 'DELETED') {
            const builds = await buildService.getBuildsForWorkload(workloadId);
            const remaining = builds.filter(build => build.workloadType === workloadType);
            if (remaining.length === 0) {
                this.setNotBuilt(workloadType, workloadId);
            } else {
                this.reconcileGroup(workloadType, workloadId, remaining);
            }
            return;
        }

        const status = buildService.getJobStatusString(job.status);
        const existing = this.statuses.get(this.key(workloadType, workloadId));
        const isDifferentBuild = !!existing?.buildName && !!buildName && existing.buildName !== buildName;
        if (isDifferentBuild) {
            const incomingStart = this.toTime(job.status?.startTime);
            const existingStart = this.toTime(existing?.startedAt);
            const isOlderBuild = !!incomingStart && !!existingStart && incomingStart < existingStart;
            const isStaleTerminalForActiveBuild = isActiveBuildStatus(existing.status) && !isActiveBuildStatus(status);
            if (isOlderBuild || isStaleTerminalForActiveBuild) {
                return;
            }
        }

        this.setStatus({
            workloadId,
            workloadType,
            workloadName: existing?.workloadName ?? workloadId,
            projectId: annotations?.[Constants.QS_ANNOTATION_PROJECT_ID] ?? existing?.projectId ?? '',
            projectName: existing?.projectName ?? '',
            status,
            buildName,
            gitCommit: annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT] || existing?.gitCommit,
            gitCommitMessage: annotations?.[Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE] || existing?.gitCommitMessage,
            deploymentId: annotations?.[Constants.QS_ANNOTATION_DEPLOYMENT_ID] || existing?.deploymentId,
            buildMethod: (annotations?.[Constants.QS_ANNOTATION_BUILD_METHOD] as AppBuildMethod) || existing?.buildMethod,
            startedAt: job.status?.startTime ?? existing?.startedAt,
            completionTime: job.status?.completionTime ?? existing?.completionTime,
        });
    }

    /** Rebuilds the cache from Kubernetes. Concurrent callers share one request. */
    async ensureSeeded(): Promise<void> {
        if (this.seedPromise) {
            return this.seedPromise;
        }

        const seedPromise = (async () => {
            const builds = await buildService.getAllBuilds();
            // A restarted watch receives ADDED only for jobs that still exist.
            // Drop statuses for jobs that disappeared during the restart gap.
            this.statuses.clear();
            this.applyBuildJobs(builds);
        })();
        this.seedPromise = seedPromise;

        try {
            await seedPromise;
        } finally {
            if (this.seedPromise === seedPromise) {
                this.seedPromise = null;
            }
        }
    }

    reset(): void {
        this.statuses.clear();
        this.subscribers.clear();
        this.seedPromise = null;
    }

    private reconcileGroup(workloadType: WorkloadType, workloadId: string, builds: ReconcilableBuild[]): void {
        const active = builds.find(build => build.status === 'RUNNING')
            ?? builds.find(build => build.status === 'PENDING');
        const latestFinished = builds
            .filter(build => build.status !== 'RUNNING' && build.status !== 'PENDING')
            .sort((a, b) => this.toTime(b.startTime) - this.toTime(a.startTime))[0];
        const chosen = active ?? latestFinished;
        if (!chosen) {
            this.setNotBuilt(workloadType, workloadId);
            return;
        }

        const existing = this.statuses.get(this.key(workloadType, workloadId));
        this.setStatus({
            workloadId,
            workloadType,
            workloadName: chosen.workloadName || existing?.workloadName || workloadId,
            projectId: chosen.projectId ?? existing?.projectId ?? '',
            projectName: chosen.projectName ?? existing?.projectName ?? '',
            status: chosen.status,
            buildName: chosen.name,
            gitCommit: chosen.gitCommit || undefined,
            gitCommitMessage: chosen.gitCommitMessage || undefined,
            deploymentId: chosen.deploymentId || undefined,
            buildMethod: chosen.buildMethod,
            startedAt: chosen.startTime,
            completionTime: chosen.completionTime,
        });
    }

    private setNotBuilt(workloadType: WorkloadType, workloadId: string): void {
        const existing = this.statuses.get(this.key(workloadType, workloadId));
        this.setStatus({
            workloadId,
            workloadType,
            workloadName: existing?.workloadName ?? workloadId,
            projectId: existing?.projectId ?? '',
            projectName: existing?.projectName ?? '',
            status: 'NOT_BUILT',
        });
    }

    private setStatus(entry: AppBuildStatusModel): void {
        const entryKey = this.key(entry.workloadType, entry.workloadId);
        const existing = this.statuses.get(entryKey);
        if (existing && this.signature(existing) === this.signature(entry)) {
            return;
        }
        this.statuses.set(entryKey, entry);
        this.notify(entry);
    }

    private notify(status: AppBuildStatusModel): void {
        for (const subscriber of this.subscribers) {
            try {
                const result = subscriber(status);
                if (result && typeof result.then === 'function') {
                    result.catch((error) => console.error('[BuildStatus] Subscriber error:', error));
                }
            } catch (error) {
                console.error('[BuildStatus] Subscriber error:', error);
            }
        }
    }

    private signature(status: AppBuildStatusModel): string {
        return [
            status.status,
            status.buildName ?? '',
            status.gitCommit ?? '',
            status.deploymentId ?? '',
            status.startedAt ? this.toTime(status.startedAt) : '',
            status.completionTime ? this.toTime(status.completionTime) : '',
        ].join('|');
    }

    private toTime(value?: Date | string): number {
        if (!value) {
            return 0;
        }
        return value instanceof Date ? value.getTime() : new Date(value).getTime();
    }

    private key(workloadType: WorkloadType, workloadId: string): string {
        return `${workloadType}:${workloadId}`;
    }
}

const buildStatusService = globalThis.buildStatusServiceInstance ?? new BuildStatusPubSubService();
globalThis.buildStatusServiceInstance = buildStatusService;
export default buildStatusService;
