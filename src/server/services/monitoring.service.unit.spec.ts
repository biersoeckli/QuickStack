vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));

import * as k8s from '@kubernetes/client-node';

const k8sMocks = vi.hoisted(() => ({ topPods: vi.fn() }));

vi.mock('@kubernetes/client-node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kubernetes/client-node')>();
  return { ...actual, topPods: k8sMocks.topPods };
});

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
  default: { core: { listNode: vi.fn(), listPersistentVolume: vi.fn() }, getNodeSummary: vi.fn(), getKubeConfig: vi.fn(() => ({})) }
}));

vi.mock('@/server/adapter/db.client', () => ({ default: { client: { appVolume: { findMany: vi.fn() } } } }));

vi.mock('@/server/services/project.service', () => ({ default: { getAll: vi.fn() } }));

vi.mock('@/server/services/cluster.service', () => ({ default: { getNodeInfo: vi.fn() } }));

vi.mock('@/server/services/pvc.service', () => ({ default: { getAllPvc: vi.fn() } }));

vi.mock('@/server/services/standalone-services/standalone-pod.service', () => ({ default: { getPodsForApp: vi.fn() } }));

import k3s from '@/server/adapter/kubernetes-api.adapter';
import dataAccess from '@/server/adapter/db.client';
import projectService from '@/server/services/project.service';
import clusterService from '@/server/services/cluster.service';
import pvcService from '@/server/services/pvc.service';
import standalonePodService from '@/server/services/standalone-services/standalone-pod.service';
import monitoringService from './monitoring.service';

const mockedTopPods = vi.mocked(k8sMocks.topPods);
const mockedFindMany = vi.mocked(dataAccess.client.appVolume.findMany);
const mockedProjectGetAll = vi.mocked(projectService.getAll);
const mockedGetNodeInfo = vi.mocked(clusterService.getNodeInfo);
const mockedGetAllPvc = vi.mocked(pvcService.getAllPvc);
const mockedGetPodsForApp = vi.mocked(standalonePodService.getPodsForApp);

function nodeInfo(overrides: Record<string, unknown> = {}) {
  return { name: 'node-1', cpuCapacity: '8', ramCapacity: '16Gi', ...overrides };
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
    Memory: { CurrentUsage: ram }
  } as unknown as k8s.PodStatus;
}

function appVolume(id: string, appId: string, size: number, sharedVolumeId: string | null) {
  return { id, appId, size, sharedVolumeId, containerMountPath: `/${id}`, app: { projectId: 'proj-1', name: `App ${appId}`, project: { name: 'Project 1' } } };
}

describe('monitoringService.getMonitoringForAllApps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetNodeInfo.mockResolvedValue([nodeInfo()] as never);
  });

  it('fetches cluster pod metrics once regardless of the app count', async () => {
    mockedProjectGetAll.mockResolvedValue([
      project(
        'proj-1',
        'Project 1',
        Array.from({ length: 100 }, (_, i) => app(`app-${i}`))
      )
    ] as never);
    mockedTopPods.mockResolvedValue([topPod('proj-1', 'pod-0', 'app-0', 1, 1024)]);

    const result = await monitoringService.getMonitoringForAllApps();

    expect(mockedTopPods).toHaveBeenCalledTimes(1);
    expect(mockedGetPodsForApp).not.toHaveBeenCalled();
    expect(result).toHaveLength(100);
  });

  it('assigns pod metrics by namespace and app label without listing pods per app', async () => {
    mockedProjectGetAll.mockResolvedValue([project('proj-1', 'Project 1', [app('app-a')]), project('proj-2', 'Project 2', [app('app-b', 'proj-2')])] as never);
    mockedTopPods.mockResolvedValue([
      topPod('proj-1', 'pod-a-1', 'app-a', 2, 200),
      topPod('proj-1', 'pod-a-2', 'app-a', 1, 100),
      topPod('proj-2', 'pod-b-1', 'app-b', 4, 400),
      topPod('proj-1', 'pod-unlabeled', undefined, 8, 800),
      topPod('proj-3', 'pod-other-namespace', 'app-a', 16, 1600)
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
  it('reports fresh Longhorn filesystem usage for the configured volume', async () => {
    mockedFindMany.mockResolvedValue([appVolume('vol-1', 'app-1', 1024, null)] as never);
    mockedGetAllPvc.mockResolvedValue([{ metadata: { name: 'pvc-vol-1', namespace: 'proj-1' }, spec: { volumeName: 'pv-1' } }] as never);
    vi.mocked(k3s.core.listPersistentVolume).mockResolvedValue({
      items: [{ metadata: { name: 'pv-1' }, spec: { csi: { driver: 'driver.longhorn.io' } } }]
    } as never);
    vi.mocked(k3s.core.listNode).mockResolvedValue({ items: [{ metadata: { name: 'node-1' } }] } as never);
    vi.mocked(k3s.getNodeSummary).mockResolvedValue({
      pods: [
        {
          podRef: { namespace: 'proj-1' },
          volume: [
            { pvcRef: { namespace: 'proj-1', name: 'pvc-vol-1' }, time: new Date().toISOString(), usedBytes: 111, availableBytes: 889, capacityBytes: 1000 }
          ]
        }
      ]
    });

    const result = await monitoringService.getAllAppVolumesUsage();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ usedBytes: 111, availableBytes: 889, capacityBytes: 1000, status: 'available' });
  });
  it('keeps shared and unavailable volumes while using fresh samples across nodes', async () => {
    mockedFindMany.mockResolvedValue([
      appVolume('vol-1', 'app-1', 1, null),
      appVolume('vol-2', 'app-2', 1, 'vol-1'),
      appVolume('vol-3', 'app-3', 1, null),
      appVolume('vol-4', 'app-4', 1, null),
      appVolume('vol-5', 'app-5', 1, null)
    ] as never);
    mockedGetAllPvc.mockResolvedValue([
      { metadata: { namespace: 'proj-1', name: 'pvc-vol-1' }, spec: { volumeName: 'pv-1' } },
      { metadata: { namespace: 'proj-1', name: 'pvc-vol-3' }, spec: { volumeName: 'pv-3' } },
      { metadata: { namespace: 'proj-1', name: 'pvc-vol-4' }, spec: { volumeName: 'pv-4' } }
    ] as never);
    vi.mocked(k3s.core.listPersistentVolume).mockResolvedValue({
      items: [
        { metadata: { name: 'pv-1' }, spec: { csi: { driver: 'driver.longhorn.io' } } },
        { metadata: { name: 'pv-3' }, spec: { csi: { driver: 'driver.longhorn.io' } } },
        { metadata: { name: 'pv-4' }, spec: { csi: { driver: 'rancher.io/local-path' } } }
      ]
    } as never);
    vi.mocked(k3s.core.listNode).mockResolvedValue({ items: [{ metadata: { name: 'broken' } }, { metadata: { name: 'healthy' } }] } as never);
    vi.mocked(k3s.getNodeSummary).mockImplementation(async (name) => {
      if (name === 'broken') throw new Error('node unavailable');
      return {
        pods: [
          {
            volume: [
              { pvcRef: { namespace: 'proj-1', name: 'pvc-vol-1' }, time: new Date().toISOString(), usedBytes: 0, availableBytes: 1000, capacityBytes: 1000 },
              {
                pvcRef: { namespace: 'proj-1', name: 'pvc-vol-3' },
                time: new Date(Date.now() - 600000).toISOString(),
                usedBytes: 500,
                availableBytes: 500,
                capacityBytes: 1000
              },
              { pvcRef: { namespace: 'proj-1', name: 'pvc-vol-4' }, time: new Date().toISOString(), usedBytes: 500, availableBytes: 500, capacityBytes: 1000 }
            ]
          }
        ]
      };
    });
    const result = await monitoringService.getAllAppVolumesUsage();
    expect(result).toHaveLength(5);
    expect(result.find((v) => v.appId === 'app-1')).toMatchObject({ status: 'available', usedBytes: 0 });
    expect(result.find((v) => v.appId === 'app-2')).toMatchObject({ status: 'available', usedBytes: 0, pvcName: 'pvc-vol-1' });
    expect(result.find((v) => v.appId === 'app-3')).toMatchObject({ status: 'stale' });
    expect(result.find((v) => v.appId === 'app-4')).toMatchObject({ status: 'unsupported' });
    expect(result.find((v) => v.appId === 'app-5')).toMatchObject({ status: 'unavailable' });
  });

  it('treats missing fields and zero capacity as unavailable', async () => {
    mockedFindMany.mockResolvedValue([appVolume('vol-1', 'app-1', 1, null)] as never);
    mockedGetAllPvc.mockResolvedValue([{ metadata: { namespace: 'proj-1', name: 'pvc-vol-1' }, spec: { volumeName: 'pv-1' } }] as never);
    vi.mocked(k3s.core.listPersistentVolume).mockResolvedValue({
      items: [{ metadata: { name: 'pv-1' }, spec: { csi: { driver: 'driver.longhorn.io' } } }]
    } as never);
    vi.mocked(k3s.core.listNode).mockResolvedValue({ items: [{ metadata: { name: 'node-1' } }] } as never);
    vi.mocked(k3s.getNodeSummary).mockResolvedValue({
      pods: [
        {
          volume: [
            { pvcRef: { namespace: 'proj-1', name: 'pvc-vol-1' }, time: new Date().toISOString(), usedBytes: 0, capacityBytes: 100 },
            { pvcRef: { namespace: 'proj-1', name: 'pvc-vol-1' }, time: new Date().toISOString(), usedBytes: 0, availableBytes: 0, capacityBytes: 0 }
          ]
        }
      ]
    });
    expect((await monitoringService.getAllAppVolumesUsage())[0]).toMatchObject({ status: 'unavailable' });
  });

  it('reports unknown drivers and unmounted bound volumes without exposing host usage', async () => {
    mockedFindMany.mockResolvedValue([appVolume('unknown', 'app-1', 1, null), appVolume('unmounted', 'app-2', 1, null)] as never);
    mockedGetAllPvc.mockResolvedValue([
      { metadata: { namespace: 'proj-1', name: 'pvc-unknown' }, spec: { volumeName: 'pv-unknown' } },
      { metadata: { namespace: 'proj-1', name: 'pvc-unmounted' }, spec: { volumeName: 'pv-unmounted' } }
    ] as never);
    vi.mocked(k3s.core.listPersistentVolume).mockResolvedValue({
      items: [
        { metadata: { name: 'pv-unknown' }, spec: { csi: { driver: 'example.org/unknown' } } },
        { metadata: { name: 'pv-unmounted' }, spec: { csi: { driver: 'driver.longhorn.io' } } }
      ]
    } as never);
    vi.mocked(k3s.core.listNode).mockResolvedValue({ items: [] } as never);
    const result = await monitoringService.getAllAppVolumesUsage();
    expect(result.find((v) => v.appId === 'app-1')).toMatchObject({ status: 'unsupported' });
    expect(result.find((v) => v.appId === 'app-2')).toMatchObject({ status: 'unavailable' });
  });

  it('returns the underlying PVC measurement for an app shared volume', async () => {
    mockedFindMany.mockResolvedValue([{ id: 'shared', sharedVolumeId: 'base' }] as never);
    mockedGetAllPvc.mockResolvedValue([{ metadata: { namespace: 'proj-1', name: 'pvc-base' }, spec: { volumeName: 'pv-base' } }] as never);
    vi.mocked(k3s.core.listPersistentVolume).mockResolvedValue({
      items: [{ metadata: { name: 'pv-base' }, spec: { csi: { driver: 'driver.longhorn.io' } } }]
    } as never);
    vi.mocked(k3s.core.listNode).mockResolvedValue({ items: [{ metadata: { name: 'node-1' } }] } as never);
    vi.mocked(k3s.getNodeSummary).mockResolvedValue({
      pods: [
        {
          volume: [{ pvcRef: { namespace: 'proj-1', name: 'pvc-base' }, time: new Date().toISOString(), usedBytes: 90, availableBytes: 10, capacityBytes: 100 }]
        }
      ]
    });
    expect(await monitoringService.getPvcUsageFromApp('app-1', 'proj-1')).toEqual([
      expect.objectContaining({ pvcName: 'pvc-base', status: 'available', usedBytes: 90, availableBytes: 10, capacityBytes: 100 })
    ]);
  });
});
