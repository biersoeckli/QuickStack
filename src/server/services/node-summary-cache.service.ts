import { unstable_cache } from 'next/cache';
import k3s from '../adapter/kubernetes-api.adapter';

const cachedSummary = unstable_cache(
    (nodeName: string) => k3s.getNodeSummary(nodeName),
    ['node-summary'],
    { revalidate: 20 },
);
const inFlight = new Map<string, Promise<unknown>>();

export function getCachedNodeSummary(nodeName: string): Promise<unknown> {
    const existing = inFlight.get(nodeName);
    if (existing) return existing;

    const request = cachedSummary(nodeName).finally(() => inFlight.delete(nodeName));
    inFlight.set(nodeName, request);
    return request;
}
