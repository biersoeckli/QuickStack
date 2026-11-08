import { quantityToScalar } from '@kubernetes/client-node/dist/util.js';
import metricsAdapter from '@/server/adapter/app-history-metrics.adapter';

type App = { id: string; projectId: string };
type Measurement = { cpuCores: number | null; ramBytes: number | null; measuredAt: Date | null };

class AppHistoryService {
    async getAppMetrics(apps: App[]): Promise<Map<string, Measurement>> {
        const [pods, metrics] = await Promise.all([metricsAdapter.getPods(), metricsAdapter.getMetrics()]);
        const metricsByPod = new Map(metrics.map(metric => [`${metric.metadata.namespace}/${metric.metadata.name}`, metric]));
        const podsByApp = new Map<string, typeof pods>();
        for (const pod of pods) {
            const appId = pod.metadata?.labels?.app;
            const namespace = pod.metadata?.namespace;
            if (!appId || !namespace || ['Succeeded', 'Failed'].includes(pod.status?.phase ?? '')) continue;
            const key = `${namespace}/${appId}`;
            const group = podsByApp.get(key) ?? [];
            group.push(pod);
            podsByApp.set(key, group);
        }
        const result = new Map<string, Measurement>();
        for (const app of apps) {
            const appPods = podsByApp.get(`${app.projectId}/${app.id}`) ?? [];
            let cpu = 0;
            let ram = 0;
            let cpuComplete = appPods.length > 0;
            let ramComplete = appPods.length > 0;
            let oldest = Infinity;
            for (const pod of appPods) {
                const metric = metricsByPod.get(`${app.projectId}/${pod.metadata?.name}`);
                const timestamp = Date.parse(metric?.timestamp ?? '');
                if (!metric || !Number.isFinite(timestamp) || Date.now() - timestamp > 5 * 60_000 || timestamp - Date.now() > 60_000) {
                    cpuComplete = false;
                    ramComplete = false;
                    continue;
                }
                oldest = Math.min(oldest, timestamp);
                if (!pod.spec?.containers?.length) {
                    cpuComplete = false;
                    ramComplete = false;
                    continue;
                }
                for (const container of pod.spec.containers) {
                    const usage = metric.containers.find(item => item.name === container.name)?.usage;
                    for (const kind of ['cpu', 'memory'] as const) {
                        let value = NaN;
                        try {
                            if (usage?.[kind]) value = Number(quantityToScalar(usage[kind]));
                        } catch { /* Invalid quantities are gaps. */ }
                        if (!Number.isFinite(value) || value < 0) {
                            if (kind === 'cpu') cpuComplete = false;
                            else ramComplete = false;
                        } else if (kind === 'cpu') cpu += value;
                        else ram += value;
                    }
                }
            }
            result.set(app.id, { cpuCores: cpuComplete ? cpu : null, ramBytes: ramComplete ? ram : null, measuredAt: (cpuComplete || ramComplete) && Number.isFinite(oldest) ? new Date(oldest) : null });
        }
        return result;
    }
}

const appHistoryService = new AppHistoryService();
export default appHistoryService;
