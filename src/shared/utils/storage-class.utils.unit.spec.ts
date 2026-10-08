import { StorageClassUtils } from '@/shared/utils/storage-class.utils';

describe('StorageClassUtils', () => {

    describe('sortStorageClasses', () => {
        it('should place longhorn before local-path', () => {
            const result = StorageClassUtils.sortStorageClasses(['local-path', 'longhorn']);
            expect(result).toEqual(['longhorn', 'local-path']);
        });

        it('should sort the remaining storage classes alphabetically', () => {
            const result = StorageClassUtils.sortStorageClasses(['zfs', 'nfs', 'local-path']);
            expect(result).toEqual(['local-path', 'nfs', 'zfs']);
        });

        it('should keep longhorn first and sort all other entries alphabetically', () => {
            const result = StorageClassUtils.sortStorageClasses(['zfs', 'local-path', 'nfs', 'longhorn']);
            expect(result).toEqual(['longhorn', 'local-path', 'nfs', 'zfs']);
        });

        it('should not mutate the input array', () => {
            const input = ['local-path', 'longhorn'];
            StorageClassUtils.sortStorageClasses(input);
            expect(input).toEqual(['local-path', 'longhorn']);
        });
    });

    describe('getDefaultStorageClass', () => {
        it('should return longhorn when available', () => {
            expect(StorageClassUtils.getDefaultStorageClass(['local-path', 'longhorn'])).toBe('longhorn');
        });

        it('should fall back to the first entry when longhorn is not available', () => {
            expect(StorageClassUtils.getDefaultStorageClass(['local-path', 'nfs'])).toBe('local-path');
        });

        it('should return an empty string when no storage classes are available', () => {
            expect(StorageClassUtils.getDefaultStorageClass([])).toBe('');
        });
    });
});
