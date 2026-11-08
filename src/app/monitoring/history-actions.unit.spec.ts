vi.mock('@/server/utils/action-wrapper.utils', () => ({
    getAuthUserSession: vi.fn().mockResolvedValue({ userId: 'user' }),
    simpleAction: async (callback: () => Promise<unknown>) => ({ status: 'success', data: await callback() }),
}));
vi.mock('@/server/adapter/app-history.adapter', () => ({ default: { getPopulation: vi.fn().mockResolvedValue({ apps: [{ id: 'allowed' }, { id: 'denied' }], volumes: [] }) } }));
vi.mock('@/server/services/app-monitoring-history-query.service', () => ({ default: { getHistory: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/shared/utils/role.utils', () => ({ UserGroupUtils: { sessionHasReadAccessForApp: (_session: unknown, appId: string) => appId === 'allowed' } }));
vi.mock('@/server/services/monitoring.service', () => ({ default: {} }));
vi.mock('@/server/services/cluster.service', () => ({ default: {} }));
import history from '@/server/services/app-monitoring-history-query.service';
import { getAppMonitoringHistory } from './actions';

it('queries history only for Apps the user may read', async () => {
    await getAppMonitoringHistory();
    expect(history.getHistory).toHaveBeenCalledWith(['allowed']);
});
