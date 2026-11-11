import secretService from './secret.service';

const { core } = vi.hoisted(() => ({
    core: {
        readNamespacedSecret: vi.fn(),
        replaceNamespacedSecret: vi.fn(),
        createNamespacedSecret: vi.fn(),
        listNamespacedSecret: vi.fn(),
        deleteNamespacedSecret: vi.fn(),
    },
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: { core } }));

describe('saveSecret', () => {
    const manifest = { metadata: { name: 'pull-secret' }, data: { token: 'new' } };

    beforeEach(() => vi.resetAllMocks());

    it('replaces an existing secret using its resource version without deleting it', async () => {
        core.readNamespacedSecret.mockResolvedValue({ metadata: { name: 'pull-secret', resourceVersion: '1', labels: { owner: 'app' } } });
        await secretService.saveSecret('project', 'pull-secret', manifest);
        expect(core.replaceNamespacedSecret).toHaveBeenCalledWith({
            namespace: 'project', name: 'pull-secret',
            body: { ...manifest, metadata: { name: 'pull-secret', resourceVersion: '1', labels: { owner: 'app' } } },
        });
        expect(core.deleteNamespacedSecret).not.toHaveBeenCalled();
    });

    it('retries with the latest resource version after a conflict', async () => {
        core.readNamespacedSecret
            .mockResolvedValueOnce({ metadata: { name: 'pull-secret', resourceVersion: '1' } })
            .mockResolvedValueOnce({ metadata: { name: 'pull-secret', resourceVersion: '2' } });
        core.replaceNamespacedSecret.mockRejectedValueOnce({ code: 409 }).mockResolvedValueOnce({});
        await secretService.saveSecret('project', 'pull-secret', manifest);
        expect(core.replaceNamespacedSecret).toHaveBeenLastCalledWith(expect.objectContaining({
            body: expect.objectContaining({ metadata: expect.objectContaining({ resourceVersion: '2' }) }),
        }));
    });

    it('retries when another caller creates the secret first', async () => {
        core.readNamespacedSecret.mockRejectedValueOnce({ code: 404 })
            .mockResolvedValueOnce({ metadata: { name: 'pull-secret', resourceVersion: '1' } });
        core.createNamespacedSecret.mockRejectedValueOnce({ code: 409 });
        await secretService.saveSecret('project', 'pull-secret', manifest);
        expect(core.replaceNamespacedSecret).toHaveBeenCalledOnce();
    });
});
