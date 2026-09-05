vi.mock('./network-policy-to-extended.migration', () => ({
    default: {
        name: 'network-policy-to-extended',
        isAlreadyApplied: vi.fn(),
        runMigration: vi.fn(),
    },
}));

import configurationMigrationRegistryService from './configuration-migration-registry.service';
import networkPolicyToExtendedMigration from './network-policy-to-extended.migration';

const mockedMigration = vi.mocked(networkPolicyToExtendedMigration);

describe('ConfigurationMigrationRegistryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers the network-policy-to-extended migration', () => {
        expect(configurationMigrationRegistryService.getAll().map(migration => migration.name))
            .toEqual(['network-policy-to-extended']);
    });

    it('runs a migration that is not yet applied', async () => {
        mockedMigration.isAlreadyApplied.mockResolvedValue(false);
        mockedMigration.runMigration.mockResolvedValue(undefined);

        await configurationMigrationRegistryService.runPending();

        expect(mockedMigration.runMigration).toHaveBeenCalledTimes(1);
    });

    it('skips a migration that is already applied', async () => {
        mockedMigration.isAlreadyApplied.mockResolvedValue(true);

        await configurationMigrationRegistryService.runPending();

        expect(mockedMigration.runMigration).not.toHaveBeenCalled();
    });

    it('propagates a failure from a pending migration', async () => {
        mockedMigration.isAlreadyApplied.mockResolvedValue(false);
        mockedMigration.runMigration.mockRejectedValue(new Error('migration failed'));

        await expect(configurationMigrationRegistryService.runPending()).rejects.toThrow('migration failed');
    });
});
