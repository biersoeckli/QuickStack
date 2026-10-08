export class StorageClassUtils {
    static readonly LONGHORN = 'longhorn';
    static readonly LOCAL_PATH = 'local-path';

    static sortStorageClasses(storageClassNames: string[]): string[] {
        return storageClassNames.slice().sort((a, b) => {
            const priorityA = a === StorageClassUtils.LONGHORN ? 0 : 1;
            const priorityB = b === StorageClassUtils.LONGHORN ? 0 : 1;
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return a.localeCompare(b);
        });
    }

    static getDefaultStorageClass(storageClassNames: string[]): string {
        if (storageClassNames.includes(StorageClassUtils.LONGHORN)) {
            return StorageClassUtils.LONGHORN;
        }
        return storageClassNames[0] ?? '';
    }
}
