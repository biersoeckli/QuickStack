vi.mock('@/server/services/standalone-services/app-monitoring-history.service', () => ({ default: { getHistory: vi.fn().mockResolvedValue({ points: [] }) } }));
vi.mock('@/server/services/app.service', () => ({ default: {} }));
vi.mock('@/server/services/build.service', () => ({ default: {} }));
vi.mock('@/server/services/deployment.service', () => ({ default: {} }));
vi.mock('@/server/services/monitoring.service', () => ({ default: {} }));
vi.mock('@/server/services/pod.service', () => ({ default: {} }));
vi.mock('@/server/utils/action-wrapper.utils', () => ({
  isAuthorizedReadForApp: vi.fn(),
  isAuthorizedWriteForApp: vi.fn(),
  isAuthorizedWriteForWorkload: vi.fn(),
  simpleAction: async (callback: () => Promise<unknown>) => {
    try {
      return { status: 'success', data: await callback() };
    } catch {
      return { status: 'error' };
    }
  }
}));
import history from '@/server/services/standalone-services/app-monitoring-history.service';
import { isAuthorizedReadForApp } from '@/server/utils/action-wrapper.utils';
import { getAppMonitoringHistory } from './actions';

beforeEach(() => vi.clearAllMocks());

it('returns history for an App when the user has read access', async () => {
  vi.mocked(isAuthorizedReadForApp).mockResolvedValue({} as never);
  const result = await getAppMonitoringHistory('allowed');
  expect(result.status).toBe('success');
  expect(isAuthorizedReadForApp).toHaveBeenCalledWith('allowed');
  expect(history.getHistory).toHaveBeenCalledWith(['allowed']);
});

it('does not query history when the user cannot read the App', async () => {
  vi.mocked(isAuthorizedReadForApp).mockRejectedValue(new Error('not authorized'));
  const result = await getAppMonitoringHistory('denied');
  expect(result.status).toBe('error');
  expect(history.getHistory).not.toHaveBeenCalled();
});
