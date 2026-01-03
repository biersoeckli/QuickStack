import k3s from "../../adapter/kubernetes-api.adapter";
import * as k8s from '@kubernetes/client-node';
import { ServiceException } from "@/shared/model/service.exception.model";
import { qsVersionInfoAdapter, LonghornReleaseInfo, K3sReleaseInfo } from "../../adapter/qs-versioninfo.adapter";
import paramService, { ParamService } from "../param.service";

class LonghornUpdateService {

    private readonly LONGHORN_NAMESPACE = 'longhorn-system';
    private readonly LONGHORN_MANAGER_NAME = 'longhorn-manager';

    /**
     * Gets the currently installed Longhorn version by reading the longhorn-manager DaemonSet image tag
     * @returns The current version string (e.g., "v1.7.2") or undefined if Longhorn is not installed
     */
    async getCurrentVersion(): Promise<string | undefined> {
        try {
            const daemonSet = await k3s.apps.readNamespacedDaemonSet(
                this.LONGHORN_MANAGER_NAME,
                this.LONGHORN_NAMESPACE
            );

            const image = daemonSet.body.spec?.template?.spec?.containers?.[0]?.image;
            if (!image) {
                return undefined;
            }

            // Image format: longhornio/longhorn-manager:v1.7.2
            const version = image.split(':')[1];
            return version;
        } catch (error) {
            // Longhorn not installed or error reading
            console.error('Error getting current Longhorn version:', error);
            return undefined;
        }
    }

    /**
     * Checks if Longhorn is installed in the cluster
     */
    async isInstalled(): Promise<boolean> {
        try {
            await k3s.apps.readNamespacedDaemonSet(
                this.LONGHORN_MANAGER_NAME,
                this.LONGHORN_NAMESPACE
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Gets the version info for the currently installed Longhorn version
     */
    async getVersionInfoForCurrentVersion(): Promise<LonghornReleaseInfo | undefined> {
        const currentVersion = await this.getCurrentVersion();
        if (!currentVersion) {
            return undefined;
        }

        const versionInfo = await this.getVersionInfoForCurrentChannel();
        return versionInfo.find(v => v.version === currentVersion);
    }

    /**
     * Gets the next available Longhorn version for upgrade
     */
    async getNextAvailableVersion(): Promise<LonghornReleaseInfo | undefined> {
        const currentVersion = await this.getCurrentVersion();
        if (!currentVersion) {
            return undefined;
        }

        const versionInfo = await this.getVersionInfoForCurrentChannel();

        // Find versions newer than current using semantic version comparison
        const currentIndex = versionInfo.findIndex(v => v.version === currentVersion);
        if (currentIndex === -1) {
            // Current version not in list, return the latest compatible version
            return versionInfo.length > 0 ? versionInfo[versionInfo.length - 1] : undefined;
        }

        // Return next version if available (list is ordered oldest to newest)
        if (currentIndex < versionInfo.length - 1) {
            return versionInfo[currentIndex + 1];
        }

        // Already on latest
        return undefined;
    }

    /**
     * Gets available Longhorn versions based on channel preference
     */
    private async getVersionInfoForCurrentChannel(): Promise<LonghornReleaseInfo[]> {
        const useCanary = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false);
        if (useCanary) {
            return await qsVersionInfoAdapter.getCanaryLonghornReleaseInfo();
        }
        return await qsVersionInfoAdapter.getProdLonghornReleaseInfo();
    }

    /**
     * Checks if a Longhorn upgrade is currently in progress
     * An upgrade is considered in progress if any pod in the longhorn-system namespace
     * is not in Running or Succeeded state
     */
    async isUpgradeInProgress(): Promise<boolean> {
        try {
            const podsResponse = await k3s.core.listNamespacedPod(this.LONGHORN_NAMESPACE);
            const pods = podsResponse.body.items;

            if (pods.length === 0) {
                // No pods found, consider this as not upgrading
                return false;
            }

            // Check if all pods are either Running or Succeeded
            for (const pod of pods) {
                const podPhase = pod.status?.phase;

                // If any pod is not in Running or Succeeded state, upgrade is in progress or there's an issue
                if (podPhase !== 'Running' && podPhase !== 'Succeeded') {
                    console.log(`Pod ${pod.metadata?.name} is in ${podPhase} state - upgrade/issue in progress`);
                    return true;
                }
            }

            // All pods are Running or Succeeded
            return false;
        } catch (error) {
            console.error('Error checking Longhorn upgrade status:', error);
            return false;
        }
    }

    /**
     * Upgrades Longhorn to the next available version by applying the YAML manifest
     */
    async upgrade(): Promise<void> {
        if (!await this.isInstalled()) {
            throw new ServiceException('Longhorn is not installed. Cannot perform upgrade.');
        }

        if (await this.isUpgradeInProgress()) {
            throw new ServiceException('A Longhorn upgrade is already in progress. Please wait for it to complete.');
        }

        const nextVersion = await this.getNextAvailableVersion();
        if (!nextVersion) {
            throw new ServiceException('No newer Longhorn version available for upgrade.');
        }

        const yamlUrl = nextVersion.yamlUrl;

        console.log(`Starting Longhorn upgrade to ${nextVersion.version}...`);
        console.log(`Fetching manifest from ${yamlUrl}...`);

        await this.applyManifestFromUrl(yamlUrl);

        console.log(`Longhorn upgrade to ${nextVersion.version} initiated successfully.`);
        console.log('Note: Volumes will be automatically upgraded based on the "Concurrent Automatic Engine Upgrade Per Node Limit" setting.');
    }

    /**
     * Fetches a YAML manifest from a URL and applies it to the cluster
     * @param url URL to fetch the manifest from
     */
    private async applyManifestFromUrl(url: string): Promise<void> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch manifest from ${url}: ${response.statusText}`);
        }
        const yamlContent = await response.text();

        const specs = k8s.loadAllYaml(yamlContent);

        // Apply each resource
        for (const spec of specs) {
            if (spec && spec.kind) {
                try {
                    await k3s.applyResource(spec, spec.metadata?.namespace || this.LONGHORN_NAMESPACE);
                } catch (error) {
                    console.error(`Error applying ${spec.kind}/${spec.metadata?.name}:`, error);
                    // Continue with other resources
                }
            }
        }
    }

    /**
     * Gets detailed upgrade status including pod states
     */
    async getUpgradeStatus(): Promise<{
        isUpgrading: boolean;
        desiredPods: number;
        readyPods: number;
        updatedPods: number;
        currentVersion: string | undefined;
    }> {
        const [isUpgrading, currentVersion] = await Promise.all([
            this.isUpgradeInProgress(),
            this.getCurrentVersion()
        ]);

        let desiredPods = 0;
        let readyPods = 0;
        let updatedPods = 0;

        try {
            const daemonSet = await k3s.apps.readNamespacedDaemonSet(
                this.LONGHORN_MANAGER_NAME,
                this.LONGHORN_NAMESPACE
            );

            const status = daemonSet.body.status;
            if (status) {
                desiredPods = status.desiredNumberScheduled || 0;
                readyPods = status.numberReady || 0;
                updatedPods = status.updatedNumberScheduled || 0;
            }
        } catch (error) {
            console.error('Error getting Longhorn upgrade status:', error);
        }

        return {
            isUpgrading,
            desiredPods,
            readyPods,
            updatedPods,
            currentVersion
        };
    }
}

const longhornUpdateService = new LonghornUpdateService();
export default longhornUpdateService;
