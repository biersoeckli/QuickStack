import * as k8s from '@kubernetes/client-node';
import k3s from './kubernetes-api.adapter';

class AppHistoryMetricsAdapter {
    async getPods() {
        return (await k3s.core.listPodForAllNamespaces()).items;
    }

    async getMetrics() {
        return (await new k8s.Metrics(k3s.getKubeConfig()).getPodMetrics()).items;
    }
}

const appHistoryMetricsAdapter = new AppHistoryMetricsAdapter();
export default appHistoryMetricsAdapter;
