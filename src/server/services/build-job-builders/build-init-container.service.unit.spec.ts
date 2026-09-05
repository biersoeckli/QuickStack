import buildQueueInitContainer from "./build-init-container.service";

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        applyResource: vi.fn(),
    },
}));
vi.mock('@/server/services/registry.service', () => ({
    BUILD_NAMESPACE: 'registry-and-build',
}));

describe('BuildInitContainerService', () => {
    it('defaults to 1 max parallel build when not configured', () => {
        const container = buildQueueInitContainer.getInitContainer('build-1', '123');

        expect(container.name).toBe('build-queue-init');
        expect(container.env?.find((entry) => entry.name === 'MAX_PARALLEL_BUILDS')?.value).toBe('1');
        expect(container.args?.[0]).toContain('awk');
        expect(container.args?.[0]).toContain('Complete=True');
    });

    it('passes the configured max parallel builds as env value', () => {
        const container = buildQueueInitContainer.getInitContainer('build-1', '123', 4);

        expect(container.env?.find((entry) => entry.name === 'MAX_PARALLEL_BUILDS')?.value).toBe('4');
    });

    it('uses count-older slot logic instead of oldest-only logic', () => {
        const container = buildQueueInitContainer.getInitContainer('build-1', '123', 3);

        const script = container.args?.[0] ?? '';
        expect(script).toContain('OLDER=$(echo "$DATA" | awk');
        expect(script).toContain('older++');
        expect(script).toContain('if [ "$OLDER" -lt "$MAX_PARALLEL_BUILDS" ]; then');
        expect(script).not.toContain('min_name');
    });

    it.each([
        [0, '1'],
        [3.9, '3'],
        [20, '20'],
        [21, '20'],
        [25, '20'],
    ])('clamps configured value %s to allowed range', (configured, expected) => {
        const container = buildQueueInitContainer.getInitContainer('build-1', '123', configured);

        expect(container.env?.find((entry) => entry.name === 'MAX_PARALLEL_BUILDS')?.value).toBe(expected);
    });
});
