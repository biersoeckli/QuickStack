vi.mock('@/server/services/project.service', () => ({
    default: {
        getAll: vi.fn(),
    },
}));
vi.mock('@/server/services/standalone-services/build-status.service', () => ({
    default: {
        getStatuses: vi.fn(),
    },
}));

import projectService from '@/server/services/project.service';
import buildStatusService from '@/server/services/standalone-services/build-status.service';
import buildLiveStatusService from '@/server/services/build-live-status.service';
import { UserGroupUtils } from '@/shared/utils/role.utils';

function app(id: string, sourceType: string) {
    return { id, name: `name-${id}`, sourceType };
}

describe('BuildLiveStatusService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    describe('getBuildableAppLookup', () => {
        it('only includes apps that have to be built', async () => {
            vi.mocked(projectService.getAll).mockResolvedValue([
                {
                    id: 'project-1',
                    name: 'Project',
                    apps: [app('app-git', 'GIT'), app('app-ssh', 'GIT_SSH'), app('app-container', 'CONTAINER')],
                },
            ] as any);

            const lookup = await buildLiveStatusService.getBuildableAppLookup();

            expect(Array.from(lookup.keys()).sort()).toEqual(['app-git', 'app-ssh']);
            expect(lookup.get('app-git')).toEqual({
                appId: 'app-git',
                appName: 'name-app-git',
                projectId: 'project-1',
                projectName: 'Project',
            });
        });

        it('filters out apps the session cannot read', async () => {
            vi.mocked(projectService.getAll).mockResolvedValue([
                {
                    id: 'project-1',
                    name: 'Project',
                    apps: [app('app-1', 'GIT'), app('app-2', 'GIT')],
                },
            ] as any);
            vi.spyOn(UserGroupUtils, 'sessionHasReadAccessForApp').mockImplementation((_session, appId) => appId === 'app-1');

            const lookup = await buildLiveStatusService.getBuildableAppLookup({} as any);

            expect(Array.from(lookup.keys())).toEqual(['app-1']);
        });
    });

    describe('getInitialStatus', () => {
        it('reports NOT_BUILT for buildable apps without a build', () => {
            vi.mocked(buildStatusService.getStatuses).mockReturnValue([]);
            const appLookup = new Map([['app-1', { appId: 'app-1', appName: 'App', projectId: 'project-1', projectName: 'Project' }]]);

            const statuses = buildLiveStatusService.getInitialStatus(appLookup);

            expect(statuses).toEqual([
                expect.objectContaining({ workloadId: 'app-1', workloadType: 'app', status: 'NOT_BUILT', workloadName: 'App' }),
            ]);
        });

        it('merges known build statuses and only returns apps in the lookup', () => {
            vi.mocked(buildStatusService.getStatuses).mockReturnValue([
                { workloadId: 'app-1', workloadType: 'app', workloadName: '', projectId: '', projectName: '', status: 'RUNNING' },
                { workloadId: 'app-other', workloadType: 'app', workloadName: '', projectId: '', projectName: '', status: 'FAILED' },
                { workloadId: 'agent-1', workloadType: 'agent', workloadName: '', projectId: '', projectName: '', status: 'RUNNING' },
            ]);
            const appLookup = new Map([['app-1', { appId: 'app-1', appName: 'App', projectId: 'project-1', projectName: 'Project' }]]);

            const statuses = buildLiveStatusService.getInitialStatus(appLookup);

            expect(statuses).toEqual([
                expect.objectContaining({ workloadId: 'app-1', status: 'RUNNING', workloadName: 'App', projectId: 'project-1' }),
            ]);
        });
    });

    describe('mapBuildToStatus', () => {
        it('overrides names and project information from the app lookup', () => {
            const mapped = buildLiveStatusService.mapBuildToStatus(
                { workloadId: 'app-1', workloadType: 'app', workloadName: 'stale', projectId: '', projectName: '', status: 'SUCCEEDED' },
                { appId: 'app-1', appName: 'Fresh App', projectId: 'project-9', projectName: 'Fresh Project' },
            );

            expect(mapped).toMatchObject({
                workloadId: 'app-1',
                status: 'SUCCEEDED',
                workloadName: 'Fresh App',
                projectId: 'project-9',
                projectName: 'Fresh Project',
            });
        });
    });
});
