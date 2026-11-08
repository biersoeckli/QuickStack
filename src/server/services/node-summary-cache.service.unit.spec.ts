vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('../adapter/kubernetes-api.adapter', () => ({ default: { getNodeSummary: vi.fn() } }));

import k3s from '../adapter/kubernetes-api.adapter';
import { getCachedNodeSummary } from './node-summary-cache.service';

it('deduplicates concurrent requests per node and retries failures', async () => {
    let rejectRequest!: (error: Error) => void;
    vi.mocked(k3s.getNodeSummary).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    const first = getCachedNodeSummary('node-a');
    const second = getCachedNodeSummary('node-a');
    expect(first).toBe(second);
    expect(k3s.getNodeSummary).toHaveBeenCalledTimes(1);
    rejectRequest(new Error('failed'));
    await expect(first).rejects.toThrow('failed');
    vi.mocked(k3s.getNodeSummary).mockResolvedValueOnce({ node: {} });
    await expect(getCachedNodeSummary('node-a')).resolves.toEqual({ node: {} });
    expect(k3s.getNodeSummary).toHaveBeenCalledTimes(2);
});
