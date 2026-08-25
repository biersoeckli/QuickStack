import k3s, { kubernetesPatchOptions } from '@/server/adapter/kubernetes-api.adapter';
import { AddonLifecycleStatus, AddonMetadata, AddonOperationResult, AddonRelease, AddonResourceOperation, AddonStatus } from '@/shared/model/cluster-addon.model';
import { ServiceException } from '@/shared/model/service.exception.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';
import { PatchStrategy } from '@kubernetes/client-node';
import { ClusterAddon } from './cluster-addon.interface';

class CertManagerAddonService implements ClusterAddon {

    private static readonly NAMESPACE = 'cert-manager';
    private static readonly HELM_CHART_NAMESPACE = 'kube-system';
    private static readonly HELM_CHART_NAME = 'cert-manager';
    private static readonly HELM_CHART_GROUP = 'helm.cattle.io';
    private static readonly HELM_CHART_VERSION = 'v1';
    private static readonly HELM_CHART_PLURAL = 'helmcharts';
    private static readonly CONTROLLER_DEPLOYMENTS = ['cert-manager', 'cert-manager-webhook', 'cert-manager-cainjector'] as const;

    /** Newest first. Updates may only move to the immediately preceding release. */
    private static readonly RELEASES: readonly AddonRelease[] = [
        { version: 'v1.20.3', manifestUrl: 'oci://quay.io/jetstack/charts/cert-manager' },
        { version: 'v1.19.6', manifestUrl: 'oci://quay.io/jetstack/charts/cert-manager' },
        { version: 'v1.18.6', manifestUrl: 'oci://quay.io/jetstack/charts/cert-manager' },
    ];

    readonly metadata: AddonMetadata = {
        id: 'cert-manager',
        displayName: 'CertManager',
        description: 'Automates the management and issuance of TLS certificates. Enables HTTPS for apps in QuickStack.',
        documentationUrl: 'https://cert-manager.io/docs/',
        managedNamespaces: [CertManagerAddonService.NAMESPACE],
        canUninstall: true,
    };

    private activeOperation?: Exclude<AddonLifecycleStatus, 'notInstalled' | 'ready' | 'failed'>;

    constructor() {
        AddonKubernetesUtils.assertReleaseOrder(CertManagerAddonService.RELEASES);
    }

    async getStatus(): Promise<AddonStatus> {
        if (this.activeOperation) return { status: this.activeOperation };
        let controller: any;
        try {
            controller = await k3s.apps.readNamespacedDeployment({ name: CertManagerAddonService.CONTROLLER_DEPLOYMENTS[0], namespace: CertManagerAddonService.NAMESPACE });
        } catch (error) {
            if (AddonKubernetesUtils.isNotFound(error)) return { status: 'notInstalled' };
            return { status: 'failed', message: AddonKubernetesUtils.errorMessage(error) };
        }

        const installedVersion = AddonKubernetesUtils.getImageVersion(controller.spec?.template.spec?.containers?.[0]?.image);
        if (!installedVersion) return { status: 'failed', message: 'Could not determine the CertManager controller version.' };

        const deployments = [controller];
        try {
            for (const name of CertManagerAddonService.CONTROLLER_DEPLOYMENTS.slice(1)) {
                deployments.push(await k3s.apps.readNamespacedDeployment({ name, namespace: CertManagerAddonService.NAMESPACE }));
            }
        } catch (error) {
            if (AddonKubernetesUtils.isNotFound(error)) return { status: 'notInstalled' };
            return { status: 'failed', installedVersion, message: AddonKubernetesUtils.errorMessage(error) };
        }
        if (deployments.some((deployment) => this.hasReplicaFailure(deployment))) return { status: 'failed', installedVersion, message: 'A CertManager controller deployment reports a replica failure.' };
        if (deployments.every((deployment) => this.isAvailable(deployment))) return { status: 'ready', installedVersion };
        return { status: 'installing', installedVersion, message: 'Waiting for CertManager controller deployments to become available.' };
    }

    async install(): Promise<AddonOperationResult> {
        const status = await this.getStatus();
        if (status.status !== 'notInstalled' && !(status.status === 'failed' && !status.installedVersion)) throw new ServiceException('CertManager is already installed or installation is in progress.');
        return await this.reconcile('installing', this.getLatestRelease());
    }

    async getAvailableUpdate(): Promise<AddonRelease | undefined> {
        const status = await this.getStatus();
        if (!status.installedVersion) return undefined;
        const installedReleaseIndex = CertManagerAddonService.RELEASES.findIndex((release) => release.version === status.installedVersion);
        if (installedReleaseIndex === -1) throw new ServiceException(`Installed CertManager version ${status.installedVersion} is not managed by QuickStack.`);
        return CertManagerAddonService.RELEASES[installedReleaseIndex - 1];
    }

    async update(): Promise<AddonOperationResult> {
        const update = await this.getAvailableUpdate();
        if (!update) throw new ServiceException('No CertManager update is available.');
        return await this.reconcile('updating', update);
    }

    async uninstall(): Promise<AddonOperationResult> {
        const status = await this.getStatus();
        if (status.status === 'notInstalled') throw new ServiceException('CertManager is not installed.');
        const release = this.getManagedRelease(status.installedVersion);
        this.activeOperation = 'uninstalling';
        try {
            await k3s.customObjects.deleteNamespacedCustomObject(this.helmChartCoordinates());
            return AddonKubernetesUtils.operationResult(release, [this.helmChartResource()]);
        } catch (error) {
            return this.failedOperation(release, error);
        } finally {
            this.activeOperation = undefined;
        }
    }

    private async reconcile(operation: 'installing' | 'updating', release: AddonRelease): Promise<AddonOperationResult> {
        this.activeOperation = operation;
        try {
            const coordinates = this.helmChartCoordinates();
            const chart = this.helmChart(release);
            try {
                await k3s.customObjects.getNamespacedCustomObject(coordinates);
                await k3s.customObjects.patchNamespacedCustomObject({ ...coordinates, body: chart }, kubernetesPatchOptions(PatchStrategy.MergePatch));
            } catch (error) {
                if (!AddonKubernetesUtils.isNotFound(error)) throw error;
                await k3s.customObjects.createNamespacedCustomObject({ ...coordinates, body: chart });
            }
            return AddonKubernetesUtils.operationResult(release, [this.helmChartResource()]);
        } catch (error) {
            return this.failedOperation(release, error);
        } finally {
            this.activeOperation = undefined;
        }
    }

    private helmChartCoordinates() {
        return {
            group: CertManagerAddonService.HELM_CHART_GROUP,
            version: CertManagerAddonService.HELM_CHART_VERSION,
            namespace: CertManagerAddonService.HELM_CHART_NAMESPACE,
            plural: CertManagerAddonService.HELM_CHART_PLURAL,
            name: CertManagerAddonService.HELM_CHART_NAME
        };
    }

    private helmChart(release: AddonRelease) {
        return {
            apiVersion: `${CertManagerAddonService.HELM_CHART_GROUP}/${CertManagerAddonService.HELM_CHART_VERSION}`,
            kind: 'HelmChart',
            metadata: {
                name: CertManagerAddonService.HELM_CHART_NAME,
                namespace: CertManagerAddonService.HELM_CHART_NAMESPACE
            },
            spec: {
                chart: release.manifestUrl,
                version: release.version,
                targetNamespace: CertManagerAddonService.NAMESPACE,
                createNamespace: true,
                takeOwnership: true,
                set: { 'crds.enabled': 'true' }
            },
        };
    }

    private helmChartResource(): AddonResourceOperation {
        return {
            apiVersion: `${CertManagerAddonService.HELM_CHART_GROUP}/${CertManagerAddonService.HELM_CHART_VERSION}`,
            kind: 'HelmChart', name: CertManagerAddonService.HELM_CHART_NAME,
            namespace: CertManagerAddonService.HELM_CHART_NAMESPACE,
            status: 'succeeded'
        };
    }

    private failedOperation(release: AddonRelease, error: unknown): AddonOperationResult {
        return AddonKubernetesUtils.operationResult(release, [{
            ...this.helmChartResource(),
            status: 'failed',
            error: AddonKubernetesUtils.errorMessage(error)
        }]);
    }

    private getLatestRelease(): AddonRelease {
        return CertManagerAddonService.RELEASES[0];
    }

    private getManagedRelease(installedVersion: string | undefined): AddonRelease {
        if (!installedVersion) throw new ServiceException('Cannot uninstall CertManager without a detected controller version.');
        const release = CertManagerAddonService.RELEASES.find((candidate) => candidate.version === installedVersion);
        if (!release) throw new ServiceException(`Installed CertManager version ${installedVersion} is not managed by QuickStack.`);
        return release;
    }

    private isAvailable(deployment: any): boolean {
        return deployment.status?.conditions?.some((condition: any) => condition.type === 'Available' && condition.status === 'True') ?? false;
    }
    private hasReplicaFailure(deployment: any): boolean {
        return deployment.status?.conditions?.some((condition: any) => condition.type === 'ReplicaFailure' && condition.status === 'True') ?? false;
    }
}

const certManagerAddonService = new CertManagerAddonService();
export default certManagerAddonService;
