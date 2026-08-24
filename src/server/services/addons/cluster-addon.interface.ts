import {
    AddonMetadata,
    AddonOperationResult,
    AddonRelease,
    AddonStatus,
} from '@/shared/model/cluster-addon.model';

/**
 * Contract implemented by every trusted Cluster Add-on.
 * Each Add-on owns its manifest source, configuration, Kubernetes reconciliation and status checks.
 */
export interface ClusterAddon {
    readonly metadata: AddonMetadata;

    getStatus(): Promise<AddonStatus>;
    install(): Promise<AddonOperationResult>;
    getAvailableUpdate(): Promise<AddonRelease | undefined>;
    update(): Promise<AddonOperationResult>;
    uninstall(): Promise<AddonOperationResult>;
}
