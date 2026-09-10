vi.mock('@/server/services/project.service', () => ({
    default: {
        getAll: vi.fn(),
    },
}));

vi.mock('@/server/services/deployment.service', () => ({
    default: {
        getAllDeployments: vi.fn(),
        mapReplicasetToStatus: vi.fn(),
    },
}));

import deploymentService from '@/server/services/deployment.service';
import deploymentLiveStatusService, { AppLookupInfo } from '@/server/services/deployment-live-status.service';
import { V1Deployment } from '@kubernetes/client-node';

const appLookup = new Map<string, AppLookupInfo>([
    ['app-1', { appName: 'App One', projectId: 'proj-1', projectName: 'Project One' }],
    ['app-2', { appName: 'App Two', projectId: 'proj-2', projectName: 'Project Two' }],
    ['app-3', { appName: 'App Three', projectId: 'proj-1', projectName: 'Project One' }],
]);

function deployment(name: string, namespace: string, replicas: number, readyReplicas: number): V1Deployment {
    return {
        metadata: { name, namespace },
        status: { replicas, readyReplicas },
    } as V1Deployment;
}

describe('DeploymentLiveStatusService.getInitialStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(deploymentService.mapReplicasetToStatus).mockReturnValue('DEPLOYED');
    });

    it('assigns deployments by namespace and name instead of searching per app', async () => {
        vi.mocked(deploymentService.getAllDeployments).mockResolvedValue([
            deployment('app-1', 'proj-1', 2, 2),
            deployment('app-2', 'proj-2', 1, 0),
            deployment('app-3', 'proj-2', 5, 5),
        ]);

        const result = await deploymentLiveStatusService.getInitialStatus(appLookup);

        expect(result).toHaveLength(3);
        expect(deploymentService.getAllDeployments).toHaveBeenCalledTimes(1);
        expect(deploymentService.mapReplicasetToStatus).toHaveBeenCalledTimes(2);

        const app1 = result.find((entry) => entry.appId === 'app-1')!;
        expect(app1).toMatchObject({
            appName: 'App One',
            projectId: 'proj-1',
            replicas: 2,
            readyReplicas: 2,
            deploymentStatus: 'DEPLOYED',
        });

        const app2 = result.find((entry) => entry.appId === 'app-2')!;
        expect(app2).toMatchObject({
            projectId: 'proj-2',
            replicas: 1,
            readyReplicas: 0,
        });

        // app-3 exists only in proj-2, so the proj-1 app must not pick it up
        const app3 = result.find((entry) => entry.appId === 'app-3')!;
        expect(app3.deploymentStatus).toBe('SHUTDOWN');
        expect(app3.replicas).toBeUndefined();
        expect(app3.readyReplicas).toBeUndefined();
    });

    it('marks every known app as SHUTDOWN when no deployments exist', async () => {
        vi.mocked(deploymentService.getAllDeployments).mockResolvedValue([]);

        const result = await deploymentLiveStatusService.getInitialStatus(appLookup);

        expect(result).toHaveLength(3);
        expect(result.every((entry) => entry.deploymentStatus === 'SHUTDOWN')).toBe(true);
    });

    it('ignores deployments missing a name or namespace', async () => {
        vi.mocked(deploymentService.getAllDeployments).mockResolvedValue([
            { metadata: { name: 'app-1' }, status: { replicas: 1 } } as V1Deployment,
            { metadata: { namespace: 'proj-1' }, status: { replicas: 1 } } as V1Deployment,
        ]);

        const result = await deploymentLiveStatusService.getInitialStatus(appLookup);

        expect(result.every((entry) => entry.deploymentStatus === 'SHUTDOWN')).toBe(true);
    });
});
