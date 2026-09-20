import projectService from './project.service';
import buildStatusService from './standalone-services/build-status-pub-sub.service';
import { AppBuildStatusModel } from '@/shared/model/app-build-status.model';
import { UserSession } from '@/shared/model/sim-session.model';
import { UserGroupUtils } from '@/shared/utils/role.utils';

export interface BuildableAppInfo {
    appId: string;
    appName: string;
    projectId: string;
    projectName: string;
}

const BUILDABLE_SOURCE_TYPES = ['GIT', 'GIT_SSH'];

class BuildLiveStatusService {

    /** Lists all apps that are built from source, filtered by the session's read access. */
    async getBuildableAppLookup(session?: UserSession): Promise<Map<string, BuildableAppInfo>> {
        const projects = await projectService.getAll();
        const appLookup = new Map<string, BuildableAppInfo>();

        for (const project of projects) {
            for (const app of project.apps) {
                if (!BUILDABLE_SOURCE_TYPES.includes(app.sourceType)) {
                    continue;
                }
                if (session && !UserGroupUtils.sessionHasReadAccessForProjectWorkload(session, app.id)) {
                    continue;
                }
                appLookup.set(app.id, {
                    appId: app.id,
                    appName: app.name,
                    projectId: project.id,
                    projectName: project.name,
                });
            }
        }
        return appLookup;
    }

    /**
     * Builds the initial SSE payload. Apps without a known build are reported as
     * NOT_BUILT so every buildable app always has a status.
     */
    getInitialStatus(appLookup: Map<string, BuildableAppInfo>): AppBuildStatusModel[] {
        const result: AppBuildStatusModel[] = [];
        const knownAppIds = new Set<string>();

        for (const status of buildStatusService.getStatuses()) {
            if (status.workloadType !== 'app') {
                continue;
            }
            const appInfo = appLookup.get(status.workloadId);
            if (!appInfo) {
                continue;
            }
            knownAppIds.add(status.workloadId);
            result.push(this.mapBuildToStatus(status, appInfo));
        }

        for (const [appId, appInfo] of appLookup.entries()) {
            if (knownAppIds.has(appId)) {
                continue;
            }
            result.push({
                workloadId: appId,
                workloadType: 'app',
                workloadName: appInfo.appName,
                projectId: appInfo.projectId,
                projectName: appInfo.projectName,
                status: 'NOT_BUILT',
            });
        }
        return result;
    }

    mapBuildToStatus(status: AppBuildStatusModel, appInfo: BuildableAppInfo): AppBuildStatusModel {
        return {
            ...status,
            workloadName: appInfo.appName,
            projectId: appInfo.projectId,
            projectName: appInfo.projectName,
        };
    }
}

const buildLiveStatusService = new BuildLiveStatusService();
export default buildLiveStatusService;
