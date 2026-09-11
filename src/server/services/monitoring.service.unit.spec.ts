import * as k8s from '@kubernetes/client-node';

const k8sMocks = vi.hoisted(() => ({
    topPods: vi.fn(),
}));

vi.mock('@kubernetes/client-node', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@kubernetes/client-node')>();
    return {
        ...actual,
        topPods: k8sMocks.topPods,
    };
});

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        core: {},
        getKubeConfig: vi.fn(() => ({})),
    },
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            appVolume: {
                findMany: vi.fn(),
            },
        },
    },
}));

vi.mock('@/server/adapter/longhorn-api.adapter', () => ({
    default: {
        getAllLonghornVolumes: vi.fn(),
        getLonghornVolume: vi.fn(),
    },
}));

vi.mock('@/server/services/project.service', () => ({
    default: {
        getAll: vi.fn(),
    },
}));

vi.mock('@/server/services/cluster.service', () => ({
    default: {
        getNodeInfo: vi.fn(),
    },
}));

vi.mock('@/server/services/pvc.service', () => ({
    default: {
        getAllPvc: vi.fn(),
    },
}));

vi.mock('@/server/services/standalone-services/standalone-pod.service', () => ({
    default: {
        getPodsForApp: vi.fn(),
    },
}));

import dataAccess from '@/server/adapter/db.client';
import longhornApiAdapter from '@/server/adapter/longhorn-api.adapter';
import projectService from '@/server/services/project.service';
import clusterService from '@/server/services/cluster.service';
import pvcService from '@/server/services/pvc.service';
import standalonePodService from '@/server/services/standalone-services/standalone-pod.service';
import monitoringService from './monitoring.service';

const mockedTopPods = vi.mocked(k8sMocks.topPods);
const mockedFindMany = vi.mocked(dataAccess.client.appVolume.findMany);
const mockedGetAllLonghornVolumes = vi.mocked(longhornApiAdapter.getAllLonghornVolumes);
const mockedProjectGetAll = vi.mocked(projectService.getAll);
const mockedGetNodeInfo = vi.mocked(clusterService.getNodeInfo);
const mockedGetAllPvc = vi.mocked(pvcService.getAllPvc);
const mockedGetPodsForApp = vi.mocked(standalonePodService.getPodsForApp);

function nodeInfo(overrides: Record<string, unknown> = {}) {
    return {
        name: 'node-1',
        cpuCapacity: '8',
        ramCapacity: '16Gi',
        ...overrides,
    };
}

function app(id: string, projectId = 'proj-1') {
    return { id, name: `App ${id}`, projectId };
}

function project(id: string, name: string, apps: ReturnType<typeof app>[]) {
    return { id, name, apps };
}

function topPod(namespace: string, name: string, appId: string | undefined, cpu: number, ram: number): k8s.PodStatus {
    return {
        Pod: { metadata: { namespace, name, labels: { app: appId } } },
        CPU: { CurrentUsage: cpu },
        Memory: { CurrentUsage: ram },
    } as unknown as k8s.PodStatus;
}

function appVolume(id: string, appId: string, size: number, sharedVolumeId: string | null) {
    return {
        id,
        appId,
        size,
        sharedVolumeId,
        containerMountPath: `/${id}`,
        app: {
            projectId: 'proj-1',
            name: `App ${appId}`,
            project: { name: 'Project 1' },
        },
    };
}

function pvc(name: string, volumeName: string) {
    return { metadata: { name }, spec: { volumeName } };
}

describe('monitoringService.getMonitoringForAllApps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedGetNodeInfo.mockResolvedValue([nodeInfo()] as never);
    });

    it('fetches cluster pod metrics once regardless of the app count', async () => {
        mockedProjectGetAll.mockResolvedValue([
            project('proj-1', 'Project 1', Array.from({ length: 100 }, (_, i) => app(`app-${i}`))),
        ] as never);
        mockedTopPods.mockResolvedValue([topPod('proj-1', 'pod-0', 'app-0', 1, 1024)]);

        const result = await monitoringService.getMonitoringForAllApps();

        expect(mockedTopPods).toHaveBeenCalledTimes(1);
        expect(mockedGetPodsForApp).not.toHaveBeenCalled();
        expect(result).toHaveLength(100);
    });

    it('assigns pod metrics by namespace and app label without listing pods per app', async () => {
        mockedProjectGetAll.mockResolvedValue([
            project('proj-1', 'Project 1', [app('app-a')]),
            project('proj-2', 'Project 2', [app('app-b', 'proj-2')]),
        ] as never);
        mockedTopPods.mockResolvedValue([
            topPod('proj-1', 'pod-a-1', 'app-a', 2, 200),
            topPod('proj-1', 'pod-a-2', 'app-a', 1, 100),
            topPod('proj-2', 'pod-b-1', 'app-b', 4, 400),
            topPod('proj-1', 'pod-unlabeled', undefined, 8, 800),
            topPod('proj-3', 'pod-other-namespace', 'app-a', 16, 1600),
        ]);

        const result = await monitoringService.getMonitoringForAllApps();

        const appA = result.find((entry) => entry.appId === 'app-a')!;
        const appB = result.find((entry) => entry.appId === 'app-b')!;
        expect(appA.cpuUsage).toBe(3);
        expect(appA.ramUsageBytes).toBe(300);
        expect(appA.cpuUsagePercent).toBeCloseTo((3 / 8) * 100);
        expect(appB.cpuUsage).toBe(4);
        expect(appB.ramUsageBytes).toBe(400);
        expect(mockedGetPodsForApp).not.toHaveBeenCalled();
    });
});

describe('monitoringService.getAllAppVolumesUsage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves the correct pvc and longhorn volume for each app volume', async () => {
        mockedGetAllLonghornVolumes.mockResolvedValue([
            { name: 'lh-1', actualSizeBytes: 111, sizeBytes: 1000 },
            { name: 'lh-2', actualSizeBytes: 222, sizeBytes: 2000 },
        ]);
        mockedFindMany.mockResolvedValue([
            appVolume('vol-1', 'app-1', 1024, null),
            appVolume('vol-2', 'app-2', 2048, null),
        ] as never);
        mockedGetAllPvc.mockResolvedValue([
            pvc('pvc-vol-1', 'lh-1'),
            pvc('pvc-vol-2', 'lh-2'),
        ] as never);

        const result = await monitoringService.getAllAppVolumesUsage();

        expect(result).toHaveLength(2);
        expect(result.find((volume) => volume.appId === 'app-1')).toMatchObject({
            usedBytes: 111,
            capacityBytes: 1024 * 1024 * 1024,
            isBaseVolume: true,
        });
        expect(result.find((volume) => volume.appId === 'app-2')).toMatchObject({
            usedBytes: 222,
            capacityBytes: 2048 * 1024 * 1024,
            isBaseVolume: true,
        });
    });

    it('derives a shared volume from its base volume and longhorn counterpart', async () => {
        mockedGetAllLonghornVolumes.mockResolvedValue([
            { name: 'lh-1', actualSizeBytes: 111, sizeBytes: 1000 },
        ]);
        mockedFindMany.mockResolvedValue([
            appVolume('vol-1', 'app-1', 1024, null),
            appVolume('vol-3', 'app-3', 9999, 'vol-1'),
        ] as never);
        mockedGetAllPvc.mockResolvedValue([
            pvc('pvc-vol-1', 'lh-1'),
        ] as never);

        const result = await monitoringService.getAllAppVolumesUsage();

        expect(result.find((volume) => volume.appId === 'app-3')).toMatchObject({
            usedBytes: 111,
            capacityBytes: 1024 * 1024 * 1024,
            isBaseVolume: false,
        });
    });

    it('skips volumes without a matching pvc or longhorn volume', async () => {
        mockedGetAllLonghornVolumes.mockResolvedValue([]);
        mockedFindMany.mockResolvedValue([
            appVolume('vol-1', 'app-1', 1024, null),
        ] as never);
        mockedGetAllPvc.mockResolvedValue([] as never);

        const result = await monitoringService.getAllAppVolumesUsage();

        expect(result).toHaveLength(0);
    });
});
