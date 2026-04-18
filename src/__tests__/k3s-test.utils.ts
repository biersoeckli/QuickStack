import * as k8s from '@kubernetes/client-node';
import { K3sContainer, StartedK3sContainer } from '@testcontainers/k3s';
import { beforeAll, afterAll } from 'vitest';

/**
 * Matches the prod k3s version used by QuickStack (setup/k3s-versions.json).
 * Override via the `image` parameter of createK3sTestContext when needed.
 */
const DEFAULT_IMAGE = 'rancher/k3s:v1.31.3-k3s1';

export interface K3sTestClients {
    core: k8s.CoreV1Api;
    apps: k8s.AppsV1Api;
    batch: k8s.BatchV1Api;
    log: k8s.Log;
    network: k8s.NetworkingV1Api;
    customObjects: k8s.CustomObjectsApi;
    metrics: k8s.Metrics;
}

/**
 * Creates an isolated K3s test context for integration tests that need a real
 * Kubernetes cluster. Uses testcontainers (@testcontainers/k3s) to spin up a
 * lightweight k3s cluster in Docker.
 *
 * Automatically registers beforeAll/afterAll in the calling describe scope —
 * no manual hook wiring needed. K3sApiAdapter is also automatically wired with
 * test cluster clients in beforeAll (works whether the adapter is mocked or not).
 *
 * NOTE: Requires a Docker daemon with privileged container support. Will not
 * work in rootless Docker or Docker-in-Docker environments that forbid privileged
 * containers.
 *
 * Usage:
 *   vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
 *
 *   describe('my suite', () => {
 *       const ctx = createK3sTestContext();
 *       // K3sApiAdapter is automatically wired — no extra beforeAll needed
 *
 *       it('my test', async () => {
 *           const { core } = ctx.getClients();
 *           const nodes = await core.listNode();
 *           expect(nodes.items).toHaveLength(1);
 *       });
 *   });
 */
export function createK3sTestContext(image = DEFAULT_IMAGE) {
    let container: StartedK3sContainer | undefined;
    let kubeConfig: k8s.KubeConfig | undefined;

    function withInsecureTls(kubeConfigString: string): string {
        const withoutCaData = kubeConfigString
            .replace(/^\s*certificate-authority-data:\s*.*\r?\n/gm, '')
            .replace(/^\s*certificate-authority:\s*.*\r?\n/gm, '');

        if (/^\s*insecure-skip-tls-verify:\s*/m.test(withoutCaData)) {
            return withoutCaData.replace(
                /^(\s*)insecure-skip-tls-verify:\s*.*$/gm,
                '$1insecure-skip-tls-verify: true'
            );
        }

        const withListCluster = withoutCaData.replace(
            /^(\s*)-\s*cluster:\s*(\r?\n)/m,
            '$1- cluster:$2$1    insecure-skip-tls-verify: true$2'
        );

        if (withListCluster !== withoutCaData) {
            return withListCluster;
        }

        return withoutCaData.replace(
            /^(\s*)cluster:\s*(\r?\n)/m,
            '$1cluster:$2$1  insecure-skip-tls-verify: true$2'
        );
    }

    beforeAll(async () => {
        container = await new K3sContainer(image).start();
        kubeConfig = new k8s.KubeConfig();
        const kubeConfigString = container.getKubeConfig();
        kubeConfig.loadFromString(withInsecureTls(kubeConfigString));

        // Auto-wire K3sApiAdapter with test cluster clients.
        // Works whether the adapter is mocked ({ default: {} }) or real.
        const { default: k3sAdapter } = await import('@/server/adapter/kubernetes-api.adapter');
        Object.assign(k3sAdapter, getClients());
    });

    it('healthcheck for k3s cluster', async () => {
        const c = getClients();
        const nodes = await c.core.listNode();
        expect(nodes.body.items).toHaveLength(1);
    });

    afterAll(async () => {
        await container?.stop();
        container = undefined;
        kubeConfig = undefined;
    });

    function getKubeConfig(): k8s.KubeConfig {
        if (!kubeConfig) {
            throw new Error('K3s test context not initialised. Ensure createK3sTestContext() was called inside a describe block.');
        }
        return kubeConfig;
    }

    /**
     * Returns pre-built Kubernetes API clients wired to the test cluster.
     * Safe to call repeatedly — each call creates fresh client instances.
     */
    function getClients(): K3sTestClients {
        const kc = getKubeConfig();
        return {
            core: kc.makeApiClient(k8s.CoreV1Api),
            apps: kc.makeApiClient(k8s.AppsV1Api),
            batch: kc.makeApiClient(k8s.BatchV1Api),
            log: new k8s.Log(kc),
            network: kc.makeApiClient(k8s.NetworkingV1Api),
            customObjects: kc.makeApiClient(k8s.CustomObjectsApi),
            metrics: new k8s.Metrics(kc),
        };
    }

    return { getKubeConfig, getClients };
}
