import { AddonKubernetesUtils } from './addon-kubernetes.utils';

describe('AddonKubernetesUtils', () => {
    const release = { version: 'v0.5.6', manifestUrl: 'https://example.test/v0.5.6.yaml' };

    it('compares semantic versions', () => {
        expect(AddonKubernetesUtils.compareVersions('v0.5.6', 'v0.5.5')).toBeGreaterThan(0);
        expect(AddonKubernetesUtils.compareVersions('v1.0.0', 'v1.0.0')).toBe(0);
        expect(AddonKubernetesUtils.compareVersions('v0.5.5', 'v0.5.6')).toBeLessThan(0);
    });

    it('rejects releases that are not newest first', () => {
        expect(() => AddonKubernetesUtils.assertReleaseOrder([
            { version: 'v0.5.5', manifestUrl: 'https://example.test/v0.5.5.yaml' },
            release,
        ])).toThrow('must be ordered newest first');
    });

    it('returns a failed operation result when resource application is partial', () => {
        expect(AddonKubernetesUtils.operationResult(release, [
            { kind: 'Namespace', name: 'agent-sandbox-system', status: 'succeeded' },
            { kind: 'Deployment', name: 'agent-sandbox-controller', status: 'failed', error: 'forbidden' },
        ])).toEqual({
            status: 'failed',
            release,
            resources: [
                { kind: 'Namespace', name: 'agent-sandbox-system', status: 'succeeded' },
                { kind: 'Deployment', name: 'agent-sandbox-controller', status: 'failed', error: 'forbidden' },
            ],
            error: '1 Kubernetes resource(s) failed.',
        });
    });
});
