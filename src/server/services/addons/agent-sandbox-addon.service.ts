import agentSandboxManifestAdapter from '@/server/adapter/agent-sandbox-manifest.adapter';
import k3s from '@/server/adapter/kubernetes-api.adapter';
import {
    BASE_SANDBOX_API_GROUP,
    CLAIM_PLURAL,
    SANDBOX_API_GROUP,
    SANDBOX_API_VERSION,
    SANDBOX_PLURAL,
    TEMPLATE_PLURAL,
    WARMPOOL_PLURAL,
} from '@/server/adapter/agent-sandbox.adapter';
import {
    AddonLifecycleStatus,
    AddonMetadata,
    AddonOperationResult,
    AddonRelease,
    AddonResourceOperation,
    AddonStatus,
} from '@/shared/model/cluster-addon.model';
import { ServiceException } from '@/shared/model/service.exception.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';
import { ClusterAddon } from './cluster-addon.interface';
import { BaseClusterAddon } from './base-cluster-addon.service';

class AgentSandboxAddonService extends BaseClusterAddon implements ClusterAddon {
    private static readonly CONTROLLER_NAMESPACE = 'agent-sandbox-system';
    private static readonly CONTROLLER_NAME = 'agent-sandbox-controller';
    /** Newest first. Updates may only move to the immediately preceding release. */
    private static readonly RELEASES: readonly AddonRelease[] = [
        {
            version: 'v0.5.6',
            manifestUrl: 'https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.5.6/sandbox-with-extensions.yaml',
        },
        {
            version: 'v0.5.5',
            manifestUrl: 'https://github.com/kubernetes-sigs/agent-sandbox/releases/download/v0.5.5/sandbox-with-extensions.yaml',
        }
    ];

    readonly metadata: AddonMetadata = {
        id: 'agent-sandbox',
        displayName: 'Kubernetes Agent Sandbox',
        description: 'Installs the Agent Sandbox components and enables QuickStack to manage and deploy Agent Sandboxes.',
        documentationUrl: 'https://github.com/kubernetes-sigs/agent-sandbox',
        managedNamespaces: [AgentSandboxAddonService.CONTROLLER_NAMESPACE],
        canUninstall: true,
    };

    private activeOperation?: Exclude<AddonLifecycleStatus, 'notInstalled' | 'ready' | 'failed'>;

    constructor() {
        super();
        AddonKubernetesUtils.assertReleaseOrder(AgentSandboxAddonService.RELEASES);
    }

    async getStatus(): Promise<AddonStatus> {
        if (this.activeOperation) {
            return { status: this.activeOperation };
        }

        try {
            await k3s.customObjects.listCustomObjectForAllNamespaces({
                group: SANDBOX_API_GROUP,
                version: SANDBOX_API_VERSION,
                plural: CLAIM_PLURAL,
                limit: 1,
            });
        } catch (error) {
            if (AddonKubernetesUtils.isNotFound(error)) {
                return { status: 'notInstalled' };
            }
            return { status: 'failed', message: AddonKubernetesUtils.errorMessage(error) };
        }

        try {
            const deployment = await k3s.apps.readNamespacedDeployment({
                name: AgentSandboxAddonService.CONTROLLER_NAME,
                namespace: AgentSandboxAddonService.CONTROLLER_NAMESPACE,
            });
            const installedVersion = AddonKubernetesUtils.getImageVersion(deployment.spec?.template.spec?.containers?.[0]?.image);
            const conditions = deployment.status?.conditions ?? [];

            if (conditions.some((condition) => condition.type === 'ReplicaFailure' && condition.status === 'True')) {
                return { status: 'failed', installedVersion, message: 'The Agent Sandbox controller reports a replica failure.' };
            }
            if (conditions.some((condition) => condition.type === 'Available' && condition.status === 'True')) {
                return { status: 'ready', installedVersion };
            }
            return { status: 'installing', installedVersion, message: 'Waiting for the Agent Sandbox controller to become available.' };
        } catch (error) {
            if (AddonKubernetesUtils.isNotFound(error)) {
                return { status: 'installing', message: 'Agent Sandbox CRDs exist, but the controller deployment is not present yet.' };
            }
            return { status: 'failed', message: AddonKubernetesUtils.errorMessage(error) };
        }
    }

    async install(): Promise<AddonOperationResult> {
        const status = await this.getStatus();
        if (status.status !== 'notInstalled' && !(status.status === 'failed' && !status.installedVersion)) {
            throw new ServiceException('Kubernetes Agent Sandbox is already installed or installation is in progress.');
        }
        return await this.reconcile('installing', this.getLatestRelease());
    }

    async getAvailableUpdate(): Promise<AddonRelease | undefined> {
        const status = await this.getStatus();
        if (!status.installedVersion) {
            return undefined;
        }
        const installedReleaseIndex = AgentSandboxAddonService.RELEASES.findIndex(
            (release) => release.version === status.installedVersion,
        );
        if (installedReleaseIndex === -1) {
            throw new ServiceException(`Installed Kubernetes Agent Sandbox version ${status.installedVersion} is not managed by QuickStack.`);
        }
        return AgentSandboxAddonService.RELEASES[installedReleaseIndex - 1];
    }

    async update(): Promise<AddonOperationResult> {
        const update = await this.getAvailableUpdate();
        if (!update) {
            throw new ServiceException('No Kubernetes Agent Sandbox update is available.');
        }
        return await this.reconcile('updating', update);
    }

    async uninstall(): Promise<AddonOperationResult> {
        const status = await this.getStatus();
        if (status.status === 'notInstalled') {
            throw new ServiceException('Kubernetes Agent Sandbox is not installed.');
        }
        const installedRelease = this.getManagedRelease(status.installedVersion);

        await this.assertNoSandboxResources();
        return await this.removeManifest(installedRelease);
    }

    private async reconcile(operation: 'installing' | 'updating', release: AddonRelease): Promise<AddonOperationResult> {
        this.activeOperation = operation;
        try {
            const specs = await this.fetchManifest(release);
            const resources: AddonResourceOperation[] = [];
            for (const spec of specs) {
                resources.push(await this.applyResource(spec));
            }
            return AddonKubernetesUtils.operationResult(release, resources);
        } finally {
            this.activeOperation = undefined;
        }
    }

    private async removeManifest(release: AddonRelease): Promise<AddonOperationResult> {
        this.activeOperation = 'uninstalling';
        try {
            const specs = await this.fetchManifest(release);
            const resources: AddonResourceOperation[] = [];
            for (const spec of specs.reverse()) {
                resources.push(await this.deleteResource(spec));
            }
            return AddonKubernetesUtils.operationResult(release, resources);
        } finally {
            this.activeOperation = undefined;
        }
    }

    private async fetchManifest(release: AddonRelease): Promise<any[]> {
        return await agentSandboxManifestAdapter.getResources(release);
    }

    private async assertNoSandboxResources(): Promise<void> {
        const resources = await Promise.all([
            this.listResources(BASE_SANDBOX_API_GROUP, SANDBOX_API_VERSION, SANDBOX_PLURAL),
            this.listResources(SANDBOX_API_GROUP, SANDBOX_API_VERSION, CLAIM_PLURAL),
            this.listResources(SANDBOX_API_GROUP, SANDBOX_API_VERSION, TEMPLATE_PLURAL),
            this.listResources(SANDBOX_API_GROUP, SANDBOX_API_VERSION, WARMPOOL_PLURAL),
        ]);
        const count = resources.reduce((total, items) => total + items.length, 0);
        if (count > 0) {
            throw new ServiceException(`Cannot uninstall Kubernetes Agent Sandbox while ${count} Sandbox resource(s) still exist.`);
        }
    }

    private getLatestRelease(): AddonRelease {
        return AgentSandboxAddonService.RELEASES[0];
    }

    private getManagedRelease(installedVersion: string | undefined): AddonRelease {
        if (!installedVersion) {
            throw new ServiceException('Cannot uninstall Kubernetes Agent Sandbox without a detected controller version.');
        }
        const release = AgentSandboxAddonService.RELEASES.find((candidate) => candidate.version === installedVersion);
        if (!release) {
            throw new ServiceException(`Installed Kubernetes Agent Sandbox version ${installedVersion} is not managed by QuickStack.`);
        }
        return release;
    }

}

const agentSandboxAddonService = new AgentSandboxAddonService();
export default agentSandboxAddonService;
