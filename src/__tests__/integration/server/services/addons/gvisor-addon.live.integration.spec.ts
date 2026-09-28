import { execFileSync } from 'node:child_process';

const runLiveIntegration = process.env.RUN_GVISOR_LIVE_INTEGRATION === '1';
const describeLive = runLiveIntegration ? describe : describe.skip;

describeLive('gVisor live cluster installation', () => {
    const kubectl = process.env.KUBECTL_PATH ?? '/home/node/.local/bin/kubectl';
    const kubeconfig = process.env.KUBECONFIG ?? '/workspace/kube-config.config';
    const namespace = 'quickstack-gvisor-system';

    const kubectlOutput = (...args: string[]): string => execFileSync(kubectl, ['--kubeconfig', kubeconfig, ...args], {
        encoding: 'utf8',
        timeout: 30_000,
    });

    it('installs and verifies gVisor on every schedulable node', async () => {
        const { default: gvisorAddonService } = await import('@/server/services/addons/gvisor-addon.service');
        const initialNodes = JSON.parse(kubectlOutput('get', 'nodes', '-o', 'json')) as {
            items: Array<{ metadata: { name: string }; spec?: { unschedulable?: boolean } }>;
        };
        const targetNodeNames = initialNodes.items
            .filter((node) => !node.spec?.unschedulable)
            .map((node) => node.metadata.name);
        expect(targetNodeNames.length).toBeGreaterThan(0);

        const initialStatus = await gvisorAddonService.getStatus();
        if (initialStatus.status === 'notInstalled') {
            const result = await gvisorAddonService.install();
            expect(result.status).toBe('succeeded');
        }

        const deadline = Date.now() + 10 * 60_000;
        while (Date.now() < deadline) {
            const nodes = JSON.parse(kubectlOutput('get', 'nodes', '-o', 'json')) as {
                items: Array<{ metadata: { name: string; labels?: Record<string, string> }; spec?: { unschedulable?: boolean } }>;
            };
            const targetsReady = targetNodeNames.every((name) => {
                const node = nodes.items.find((candidate) => candidate.metadata.name === name);
                return node && !node.spec?.unschedulable && node.metadata.labels?.['quickstack.dev/gvisor'] === 'true' &&
                    node.metadata.labels?.['quickstack.dev/gvisor-version'] === '20260921';
            });
            if (targetsReady) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 5_000));
        }

        await expect(gvisorAddonService.getStatus()).resolves.toMatchObject({ status: 'ready' });
        expect(kubectlOutput('-n', namespace, 'get', 'daemonset', 'quickstack-gvisor-installer')).toContain('quickstack-gvisor-installer');
        expect(kubectlOutput('get', 'runtimeclass', 'gvisor', '-o', 'jsonpath={.handler}')).toBe('gvisor');

        const nodes = JSON.parse(kubectlOutput('get', 'nodes', '-o', 'json')) as {
            items: Array<{ metadata: { name: string; labels?: Record<string, string> }; spec?: { unschedulable?: boolean } }>;
        };
        const targetNodes = nodes.items.filter((node) => targetNodeNames.includes(node.metadata.name));
        expect(targetNodes).toHaveLength(targetNodeNames.length);
        for (const node of targetNodes) {
            expect(node.spec?.unschedulable).not.toBe(true);
            expect(node.metadata.labels?.['quickstack.dev/gvisor']).toBe('true');
            expect(node.metadata.labels?.['quickstack.dev/gvisor-version']).toBe('20260921');
        }
    }, 11 * 60_000);
});
