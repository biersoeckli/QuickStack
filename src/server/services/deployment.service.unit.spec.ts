vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
vi.mock('@/server/services/build.service', () => ({ default: {} }));
vi.mock('@/server/services/pvc.service', () => ({ default: {} }));
vi.mock('@/server/services/ingress.service', () => ({ default: {} }));
vi.mock('@/server/services/namespace.service', () => ({ default: {} }));
vi.mock('@/server/services/svc.service', () => ({ default: {} }));
vi.mock('@/server/services/registry.service', () => ({ default: {} }));
vi.mock('@/server/services/config-map.service', () => ({ default: {} }));
vi.mock('@/server/services/secret.service', () => ({ default: {} }));
vi.mock('@/server/services/file-browser-service', () => ({ default: {} }));
vi.mock('@/server/services/pod.service', () => ({ default: {} }));
vi.mock('@/server/services/network-policy.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment-logs.service', () => ({ dlog: vi.fn() }));

import deploymentService from './deployment.service';

describe('deployment.service', () => {
    it('returns only the deployment history entry matching the deployment id', async () => {
        vi.spyOn(deploymentService, 'getDeploymentHistory').mockResolvedValue([
            {
                deploymentId: 'deploy-1',
                createdAt: new Date('2024-01-01T00:00:00Z'),
                status: 'DEPLOYED',
            },
            {
                deploymentId: 'deploy-2',
                createdAt: new Date('2024-01-02T00:00:00Z'),
                status: 'ERROR',
            },
        ]);

        await expect(
            deploymentService.getDeploymentHistoryEntryById('project-1', 'app-1', 'deploy-2')
        ).resolves.toEqual(expect.objectContaining({ deploymentId: 'deploy-2' }));
    });
});
