import { V1PersistentVolume } from '@kubernetes/client-node';

interface VolumeFilesystemDriver {
    supports(volume: V1PersistentVolume): boolean;
}

const drivers: VolumeFilesystemDriver[] = [
    { supports: volume => volume.spec?.csi?.driver === 'driver.longhorn.io' },
];

export function supportsVolumeFilesystemMetrics(volume: V1PersistentVolume): boolean {
    return drivers.some(driver => driver.supports(volume));
}
