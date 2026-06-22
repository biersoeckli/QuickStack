vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: unknown) => fn,
}));

const dbMock = vi.hoisted(() => ({
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
}));

const adapterMock = vi.hoisted(() => ({
    listModelAliases: vi.fn(),
}));

vi.mock('@/server/adapter/db.client', () => ({
    default: {
        client: {
            llmGateway: dbMock,
        },
    },
}));

vi.mock('@/server/adapter/litellm-api.adapter', () => ({
    default: adapterMock,
}));

import { CryptoUtils } from '@/server/utils/crypto.utils';
import llmGatewayService from './llm-gateway.service';

describe('LlmGatewayService', () => {
    beforeEach(() => {
        process.env.NEXTAUTH_SECRET = 'test-secret';
        vi.clearAllMocks();
    });

    it('normalizes base URLs and encrypts admin keys on create', async () => {
        dbMock.create.mockImplementation(async ({ data }) => ({
            id: 'gw-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
        }));

        await llmGatewayService.save({
            name: 'Main Gateway',
            baseUrl: 'litellm.example.com/',
            adminKey: 'super-secret',
        });

        const createInput = dbMock.create.mock.calls[0][0].data;
        expect(createInput.baseUrl).toBe('https://litellm.example.com');
        expect(createInput.encryptedAdminKey).not.toBe('super-secret');
        expect(CryptoUtils.decrypt(createInput.encryptedAdminKey)).toBe('super-secret');
    });

    it('preserves existing key on edit when no replacement key is entered', async () => {
        const encryptedAdminKey = CryptoUtils.encrypt('stored-secret');
        dbMock.findFirstOrThrow.mockResolvedValueOnce({ encryptedAdminKey });
        dbMock.update.mockImplementation(async ({ where, data }) => ({
            id: where.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
        }));

        await llmGatewayService.save({
            id: 'gw-1',
            name: 'Updated Gateway',
            baseUrl: 'https://litellm.example.com/root/',
            adminKey: '',
        });

        const updateInput = dbMock.update.mock.calls[0][0].data;
        expect(updateInput.baseUrl).toBe('https://litellm.example.com/root');
        expect(CryptoUtils.decrypt(updateInput.encryptedAdminKey)).toBe('stored-secret');
    });

    it('rotates key on edit when replacement key is entered', async () => {
        dbMock.update.mockImplementation(async ({ where, data }) => ({
            id: where.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
        }));

        await llmGatewayService.save({
            id: 'gw-1',
            name: 'Updated Gateway',
            baseUrl: 'https://litellm.example.com',
            adminKey: 'new-secret',
        });

        const updateInput = dbMock.update.mock.calls[0][0].data;
        expect(CryptoUtils.decrypt(updateInput.encryptedAdminKey)).toBe('new-secret');
    });

    it('tests connection by resolving the stored key when needed', async () => {
        dbMock.findFirstOrThrow.mockResolvedValueOnce({
            encryptedAdminKey: CryptoUtils.encrypt('stored-secret'),
        });
        adapterMock.listModelAliases.mockResolvedValue(['claude-3-5-sonnet', 'gpt-4o']);

        await expect(llmGatewayService.testConnection({
            id: 'gw-1',
            name: 'Gateway',
            baseUrl: 'litellm.example.com',
            adminKey: '',
        })).resolves.toEqual({
            aliases: ['claude-3-5-sonnet', 'gpt-4o'],
        });

        expect(adapterMock.listModelAliases).toHaveBeenCalledWith(
            'https://litellm.example.com',
            'stored-secret',
        );
    });

    it('loads live aliases without caching in QuickStack', async () => {
        dbMock.findFirstOrThrow.mockResolvedValue({
            id: 'gw-1',
            name: 'Gateway',
            baseUrl: 'https://litellm.example.com',
            encryptedAdminKey: CryptoUtils.encrypt('stored-secret'),
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        adapterMock.listModelAliases.mockResolvedValue(['gpt-4o']);

        await llmGatewayService.getModelAliasesById('gw-1');
        await llmGatewayService.getModelAliasesById('gw-1');

        expect(adapterMock.listModelAliases).toHaveBeenCalledTimes(2);
    });
});
