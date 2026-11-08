import { V1PersistentVolumeClaim } from '@kubernetes/client-node';
import volumeSummaryAdapter from '@/server/adapter/volume-summary.adapter';
import { AppVolumeIdentityUtils } from '@/shared/utils/app-volume-identity.utils';
import { VolumeFilesystemUsage } from '@/shared/model/app-volume-monitoring-usage.model';
import { KubeObjectNameUtils } from '@/server/utils/kube-object-name.utils';

class AppVolumeFilesystemService {
    async getVolumeFilesystemUsage(
        volumes: { id: string; sharedVolumeId: string | null; projectId: string }[],
        getClaims: () => Promise<V1PersistentVolumeClaim[]> = () => volumeSummaryAdapter.getPersistentVolumeClaims(),
    ): Promise<Map<string, VolumeFilesystemUsage>> {
        const [pvcs, persistentVolumes, samples] = await Promise.all([
            getClaims().catch(() => []),
            volumeSummaryAdapter.getPersistentVolumes().catch(() => []),
            volumeSummaryAdapter.getSamples().catch(() => []),
        ]);
        const pvcByKey = new Map(pvcs.map(pvc => [`${pvc.metadata?.namespace}/${pvc.metadata?.name}`, pvc]));
        const pvByName = new Map(persistentVolumes.map(pv => [pv.metadata?.name, pv]));
        const result = new Map<string, VolumeFilesystemUsage>();
        const observations = new Map<string, VolumeFilesystemUsage>();
        const now = Date.now();
        for (const volume of volumes) {
            const pvcName = KubeObjectNameUtils.toPvcName(AppVolumeIdentityUtils.underlyingId(volume.id, volume.sharedVolumeId));
            const key = AppVolumeIdentityUtils.observationKey(volume.projectId, pvcName);
            const existing = observations.get(key);
            if (existing) {
                result.set(volume.id, existing);
                continue;
            }
            const pvc = pvcByKey.get(key);
            const pv = pvc?.spec?.volumeName ? pvByName.get(pvc.spec.volumeName) : undefined;
            if (!pv) {
                observations.set(key, { pvcName, status: 'unavailable' });
                result.set(volume.id, observations.get(key)!);
                continue;
            }
            if (pv.spec?.csi?.driver !== 'driver.longhorn.io') {
                observations.set(key, { pvcName, status: 'unsupported' });
                result.set(volume.id, observations.get(key)!);
                continue;
            }
            const candidates = samples
                .filter(sample => sample.pvcRef?.namespace === volume.projectId && sample.pvcRef.name === pvcName)
                .filter(sample => {
                    const values = [sample.usedBytes, sample.availableBytes, sample.capacityBytes];
                    return values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
                        && !!sample.capacityBytes && Number.isFinite(Date.parse(sample.time ?? ''));
                })
                .sort((a, b) => Date.parse(b.time!) - Date.parse(a.time!));
            const sample = candidates[0];
            const age = sample ? now - Date.parse(sample.time!) : Infinity;
            if (!sample || age > 5 * 60 * 1000 || age < -60 * 1000) {
                observations.set(key, { pvcName, status: sample ? 'stale' : 'unavailable' });
                result.set(volume.id, observations.get(key)!);
                continue;
            }
            observations.set(key, {
                pvcName,
                status: 'available',
                usedBytes: sample.usedBytes,
                availableBytes: sample.availableBytes,
                capacityBytes: sample.capacityBytes,
                measuredAt: sample.time,
            });
            result.set(volume.id, observations.get(key)!);
        }
        return result;
    }

}

const appVolumeFilesystemService = new AppVolumeFilesystemService();
export default appVolumeFilesystemService;
