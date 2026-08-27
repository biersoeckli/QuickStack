import {
    AddonOperationResult,
    AddonRelease,
    AddonResourceOperation,
} from '@/shared/model/cluster-addon.model';
import * as k8s from '@kubernetes/client-node';
import { ServiceException } from '@/shared/model/service.exception.model';

export class AddonKubernetesUtils {

    static async fetchManifestYaml(url: string, addonName: string): Promise<any[]> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new ServiceException(`Failed to fetch ${addonName} manifest: ${response.statusText}`);
        }
        return k8s.loadAllYaml(await response.text()).filter((spec): spec is any => Boolean(spec?.kind));
    }

    static toResourceOperation(spec: any): AddonResourceOperation {
        return {
            apiVersion: spec.apiVersion,
            kind: spec.kind,
            name: spec.metadata?.name ?? '<unknown>',
            namespace: spec.metadata?.namespace,
            status: 'succeeded',
        };
    }

    static getImageVersion(image: string | undefined): string | undefined {
        return image?.split('@')[0].split(':').at(-1);
    }

    static isNotFound(error: unknown): boolean {
        return (error as { code?: number })?.code === 404;
    }

    static errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    static operationResult(release: AddonRelease, resources: AddonResourceOperation[]): AddonOperationResult {
        const failed = resources.filter((resource) => resource.status === 'failed');
        if (failed.length > 0) {
            return {
                status: 'failed',
                release,
                resources,
                error: `${failed.length} Kubernetes resource(s) failed.`,
            };
        }
        return { status: 'succeeded', release, resources };
    }

    static assertReleaseOrder(releases: readonly AddonRelease[]): void {
        for (let index = 1; index < releases.length; index++) {
            if (this.compareVersions(releases[index - 1].version, releases[index].version) <= 0) {
                throw new Error('Add-on releases must be ordered newest first.');
            }
        }
    }

    static compareVersions(left: string, right: string): number {
        const toParts = (version: string) => {
            const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
            if (!match) {
                throw new Error(`Unsupported Add-on release version: ${version}`);
            }
            return match.slice(1).map(Number);
        };
        const leftParts = toParts(left);
        const rightParts = toParts(right);
        for (let index = 0; index < leftParts.length; index++) {
            if (leftParts[index] !== rightParts[index]) {
                return leftParts[index] - rightParts[index];
            }
        }
        return 0;
    }
}
