import * as k8s from '@kubernetes/client-node';

class K3sApiAdapter {

    core: k8s.CoreV1Api;
    apps: k8s.AppsV1Api;
    batch: k8s.BatchV1Api;
    log: k8s.Log;
    network: k8s.NetworkingV1Api;
    customObjects: k8s.CustomObjectsApi;
    metrics: k8s.Metrics;

    constructor() {
        this.core = this.getK8sCoreApiClient();
        this.apps = this.getK8sAppsApiClient();
        this.batch = this.getK8sBatchApiClient();
        this.log = this.getK8sLogApiClient();
        this.network = this.getK8sNetworkApiClient();
        this.customObjects = this.getK8sCustomObjectsApiClient();
        this.metrics = this.getMetricsApiClient();
    }

    getKubeConfig = () => {
        const kc = new k8s.KubeConfig();
        if (process.env.NODE_ENV === 'production') {
            kc.loadFromCluster();
        } else {
            kc.loadFromFile('/workspace/kube-config.config');
        }
        return kc;
    }

    getK8sCoreApiClient = () => {
        const kc = this.getKubeConfig()
        const k8sCoreClient = kc.makeApiClient(k8s.CoreV1Api);
        return k8sCoreClient;
    }

    getK8sAppsApiClient = () => {
        const kc = this.getKubeConfig()
        const k8sCoreClient = kc.makeApiClient(k8s.AppsV1Api);
        return k8sCoreClient;
    }

    getK8sBatchApiClient = () => {
        const kc = this.getKubeConfig()
        const k8sJobClient = kc.makeApiClient(k8s.BatchV1Api);
        return k8sJobClient;
    }

    getK8sLogApiClient = () => {
        const kc = this.getKubeConfig()
        const logClient = new k8s.Log(kc)
        return logClient;
    }

    getK8sCustomObjectsApiClient = () => {
        const kc = this.getKubeConfig()
        const client = kc.makeApiClient(k8s.CustomObjectsApi);
        return client;
    }

    getK8sNetworkApiClient = () => {
        const kc = this.getKubeConfig()
        const networkClient = kc.makeApiClient(k8s.NetworkingV1Api);
        return networkClient;
    }

    getMetricsApiClient = () => {
        return new k8s.Metrics(this.getKubeConfig());
    }
}

const k3s = new K3sApiAdapter();
export default k3s;
