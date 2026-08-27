import k3s from '@/server/adapter/kubernetes-api.adapter';
import longhornManifestAdapter from '@/server/adapter/longhorn-manifest.adapter';
import { LonghornReleaseInfo, qsVersionInfoAdapter } from '@/server/adapter/qs-versioninfo.adapter';
import {
    AddonMetadata,
    AddonOperationResult,
    AddonRelease,
    AddonResourceOperation,
    AddonStatus,
} from '@/shared/model/cluster-addon.model';
import { ServiceException } from '@/shared/model/service.exception.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';
import paramService, { ParamService } from '../param.service';
import { BaseClusterAddon } from './base-cluster-addon.service';
import { ClusterAddon } from './cluster-addon.interface';

class LonghornAddonService extends BaseClusterAddon implements ClusterAddon {
    private static readonly NAMESPACE = 'longhorn-system';
    private static readonly MANAGER_NAME = 'longhorn-manager';

    readonly metadata: AddonMetadata = {
        id: 'longhorn',
        displayName: 'Longhorn',
        description: 'Provides distributed block storage for the Kubernetes cluster across all nodes.',
        documentationUrl: 'https://longhorn.io/docs/latest/',
        managedNamespaces: [LonghornAddonService.NAMESPACE],
        canUninstall: false,
        updateWarning: {
            title: 'Before updating Longhorn, ensure that:',
            items: [
                'All critical data has been backed up.',
                'Volume backups are configured and recent.',
                'No critical workloads are running that cannot tolerate brief interruptions.',
                'You have reviewed the release notes for breaking changes.',
                'Volume engines will be upgraded automatically according to the Longhorn settings.',
            ],
        },
    };

    constructor() {
        super('longhorn');
    }

    async getStatus(): Promise<AddonStatus> {
        const activeOperation = this.getActiveOperation();
        if (activeOperation) return { status: activeOperation };
        return this.getStatusRaw();
    }

    private async getStatusRaw(): Promise<AddonStatus> {
        let daemonSet: any;
        try {
            daemonSet = await k3s.apps.readNamespacedDaemonSet({
                name: LonghornAddonService.MANAGER_NAME,
                namespace: LonghornAddonService.NAMESPACE,
            });
        } catch (error) {
            if (AddonKubernetesUtils.isNotFound(error)) return { status: 'notInstalled' };
            return { status: 'failed', message: AddonKubernetesUtils.errorMessage(error) };
        }

        const installedVersion = AddonKubernetesUtils.getImageVersion(daemonSet.spec?.template.spec?.containers?.[0]?.image);
        if (!installedVersion) {
            return { status: 'failed', message: 'Could not determine the Longhorn manager version.' };
        }

        try {
            const pods = (await k3s.core.listNamespacedPod({ namespace: LonghornAddonService.NAMESPACE })).items;
            const pendingPod = pods.find((pod) => pod.status?.phase !== 'Running' && pod.status?.phase !== 'Succeeded');
            if (pendingPod) {
                return {
                    status: 'updating',
                    installedVersion,
                    message: `Waiting for Longhorn pod ${pendingPod.metadata?.name ?? '<unknown>'} to become ready.`,
                };
            }
            return { status: 'ready', installedVersion };
        } catch (error) {
            return { status: 'failed', installedVersion, message: AddonKubernetesUtils.errorMessage(error) };
        }
    }

    async install(): Promise<AddonOperationResult> {
        return this.runExclusive('installing', async () => {
            const status = await this.getStatusRaw();
            if (status.status !== 'notInstalled' && !(status.status === 'failed' && !status.installedVersion)) {
                throw new ServiceException('Longhorn is already installed or installation is in progress.');
            }
            const catalog = await this.getCatalog();
            return this.reconcile(this.toAddonRelease(catalog.installRelease));
        });
    }

    async getAvailableUpdate(): Promise<AddonRelease | undefined> {
        const status = await this.getStatus();
        if (!status.installedVersion) return undefined;

        const { releases } = await this.getCatalog();
        const installedIndex = releases.findIndex((release) => release.version === status.installedVersion);
        const nextRelease = installedIndex === -1
            ? releases.at(-1)
            : releases[installedIndex + 1];
        return nextRelease ? this.toAddonRelease(nextRelease) : undefined;
    }

    async update(): Promise<AddonOperationResult> {
        return this.runExclusive('updating', async () => {
            const status = await this.getStatusRaw();
            if (status.status === 'updating') {
                throw new ServiceException('A Longhorn upgrade is already in progress. Please wait for it to complete.');
            }
            if (status.status !== 'ready') throw new ServiceException('Longhorn is not ready for an update.');
            const update = await this.getAvailableUpdateRaw(status);
            if (!update) throw new ServiceException('No newer Longhorn version available for upgrade.');
            return this.reconcile(update);
        });
    }

    async uninstall(): Promise<AddonOperationResult> {
        throw new ServiceException('Longhorn cannot be removed through QuickStack.');
    }

    private async reconcile(release: AddonRelease): Promise<AddonOperationResult> {
        const specs = await longhornManifestAdapter.getResources(release);
        const resources: AddonResourceOperation[] = [];
        for (const spec of specs) resources.push(await this.applyResource(spec));
        return AddonKubernetesUtils.operationResult(release, resources);
    }

    private async getCatalog() {
        const useCanary = (await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false)) ?? false;
        return await qsVersionInfoAdapter.getLonghornReleaseCatalog(useCanary);
    }

    private toAddonRelease(release: LonghornReleaseInfo): AddonRelease {
        return { version: release.version, manifestUrl: release.yamlUrl };
    }

    private async getAvailableUpdateRaw(status: AddonStatus): Promise<AddonRelease | undefined> {
        if (!status.installedVersion) return undefined;
        const { releases } = await this.getCatalog();
        const installedIndex = releases.findIndex((release) => release.version === status.installedVersion);
        const nextRelease = installedIndex === -1 ? releases.at(-1) : releases[installedIndex + 1];
        return nextRelease ? this.toAddonRelease(nextRelease) : undefined;
    }
}

const longhornAddonService = new LonghornAddonService();
export default longhornAddonService;
