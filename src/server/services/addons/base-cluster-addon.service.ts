import k3s from '@/server/adapter/kubernetes-api.adapter';
import { AddonResourceOperation } from '@/shared/model/cluster-addon.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';

/**
 * Shared Kubernetes boundary for Cluster Add-ons.
 * Add-on-specific services retain their manifest, status and lifecycle logic.
 */
export abstract class BaseClusterAddon {

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
