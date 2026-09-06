vi.mock('./network-policy-to-extended.migration', () => ({
    default: {
        name: 'network-policy-to-extended',
        runMigration: vi.fn(),
    },
}));

vi.mock('../param.service', () => ({
    default: {
        getOrUndefinedUncached: vi.fn(),
        save: vi.fn(),
    },
    ParamService: {
        LATEST_COMPLETED_CODE_MIGRATION: 'latestCompletedCodeMigration',
    },
}));

import configurationMigrationRegistryService from './configuration-migration-registry.service';
import networkPolicyToExtendedMigration from './network-policy-migration/network-policy-to-extended.migration';
import paramService from '../param.service';

const mockedMigration = vi.mocked(networkPolicyToExtendedMigration);
const mockedParamService = vi.mocked(paramService);

describe('ConfigurationMigrationRegistryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers the network-policy-to-extended migration', () => {
        expect(configurationMigrationRegistryService.getAll().map(migration => migration.name))
            .toEqual(['network-policy-to-extended']);
    });

    it('runs migrations after the latest completed migration and saves each completed name', async () => {
        mockedParamService.getOrUndefinedUncached.mockResolvedValue(null);
        mockedMigration.runMigration.mockResolvedValue(undefined);
        mockedParamService.save.mockResolvedValue({} as never);

        await configurationMigrationRegistryService.runPending();

        expect(mockedMigration.runMigration).toHaveBeenCalledTimes(1);
        expect(mockedParamService.save).toHaveBeenCalledWith({
            name: 'latestCompletedCodeMigration',
            value: 'network-policy-to-extended',
        });
    });

    it('skips migrations through the latest completed migration', async () => {
        mockedParamService.getOrUndefinedUncached.mockResolvedValue({
            value: 'network-policy-to-extended',
        } as never);

        await configurationMigrationRegistryService.runPending();

        expect(mockedMigration.runMigration).not.toHaveBeenCalled();
        expect(mockedParamService.save).not.toHaveBeenCalled();
    });

    it('propagates a failure from a pending migration', async () => {
        mockedParamService.getOrUndefinedUncached.mockResolvedValue(null);
        mockedMigration.runMigration.mockRejectedValue(new Error('migration failed'));

        await expect(configurationMigrationRegistryService.runPending()).rejects.toThrow('migration failed');
        expect(mockedParamService.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown completed migration name', async () => {
        mockedParamService.getOrUndefinedUncached.mockResolvedValue({ value: 'removed-migration' } as never);

        await expect(configurationMigrationRegistryService.runPending())
            .rejects.toThrow('Unknown completed configuration migration: removed-migration');
    });
});
