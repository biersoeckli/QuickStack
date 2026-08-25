import k3s from '@/server/adapter/kubernetes-api.adapter';
import { AddonLifecycleStatus, AddonResourceOperation } from '@/shared/model/cluster-addon.model';
import { ServiceException } from '@/shared/model/service.exception.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';

type ActiveAddonOperation = Exclude<AddonLifecycleStatus, 'notInstalled' | 'ready' | 'failed'>;

declare global {
    var quickStackAddonOperations: Map<string, ActiveAddonOperation> | undefined;
}

const addonOperations = globalThis.quickStackAddonOperations ?? new Map<string, ActiveAddonOperation>();
globalThis.quickStackAddonOperations = addonOperations;

/**
 * Shared Kubernetes boundary for Cluster Add-ons.
 * Add-on-specific services retain their manifest, status and lifecycle logic.
 */
export abstract class BaseClusterAddon {
    protected constructor(private readonly addonId: string) {}

    protected getActiveOperation(): ActiveAddonOperation | undefined {
        return addonOperations.get(this.addonId);
    }

    protected async runExclusive<T>(
        operation: ActiveAddonOperation,
        fn: () => Promise<T>,
    ): Promise<T> {
        if (addonOperations.has(this.addonId)) {
            throw new ServiceException('An operation is already in progress.');
        }
        addonOperations.set(this.addonId, operation);
        try {
            return await fn();
        } finally {
            addonOperations.delete(this.addonId);
        }
    }

    protected async listResources(group: string, version: string, plural: string): Promise<unknown[]> {
        const response = await k3s.customObjects.listCustomObjectForAllNamespaces({ group, version, plural });
        return (response as { items?: unknown[] }).items ?? [];
    }

    protected async applyResource(spec: any): Promise<AddonResourceOperation> {
        const resource = AddonKubernetesUtils.toResourceOperation(spec);
        try {
            await k3s.applyResource(spec, spec.metadata?.namespace);
            return resource;
        } catch (error) {
            return { ...resource, status: 'failed', error: AddonKubernetesUtils.errorMessage(error) };
        }
    }

    protected async deleteResource(spec: any): Promise<AddonResourceOperation> {
        const resource = AddonKubernetesUtils.toResourceOperation(spec);
        try {
            await k3s.deleteResource(spec);
            return resource;
        } catch (error) {
            if (AddonKubernetesUtils.isNotFound(error)) {
                return resource;
            }
            return { ...resource, status: 'failed', error: AddonKubernetesUtils.errorMessage(error) };
        }
    }
}
