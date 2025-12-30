import { unstable_cache } from "next/cache";
import quickStackService from "./qs.service";
import { githubAdapter } from "../adapter/github.adapter";
import { Tags } from "../utils/cache-tag-generator.utils";
import k3s from "../adapter/kubernetes-api.adapter";
import namespaceService from "./namespace.service";
import * as k8s from '@kubernetes/client-node';
import { ServiceException } from "@/shared/model/service.exception.model";

class K3sUpdateService {

    private readonly SYSTEM_UPGRADE_NAMESPACE = 'system-upgrade';
    private readonly SYSTEM_UPGRADE_CONTROLLER_NAME = 'system-upgrade-controller';
    private readonly SYSTEM_UPGRADE_CRD_URL = 'https://github.com/rancher/system-upgrade-controller/releases/latest/download/crd.yaml';
    private readonly SYSTEM_UPGRADE_CONTROLLER_URL = 'https://github.com/rancher/system-upgrade-controller/releases/latest/download/system-upgrade-controller.yaml';

    /**
     * Checks if the system-upgrade-controller deployment exists in the system-upgrade namespace.
     * This is required for automated K3s cluster upgrades.
     */
    async isSystemUpgradeControllerPresent(): Promise<boolean> {
        try {
            await k3s.apps.readNamespacedDeployment(
                this.SYSTEM_UPGRADE_CONTROLLER_NAME,
                this.SYSTEM_UPGRADE_NAMESPACE
            );
            return true;
        } catch (error) {
            // Deployment not found
            return false;
        }
    }

    /**
     * Installs the system-upgrade-controller by applying the yaml manifests from the official docs https://docs.k3s.io/upgrades/automated
     * This is required for automated K3s cluster upgrades.
     *
     * @throws Error if the installation fails
     */
    async installSystemUpgradeController(): Promise<void> {

        if (await this.isSystemUpgradeControllerPresent()) {
            throw new ServiceException('System Upgrade Controller is already installed.');
        }

        // Create the system-upgrade namespace if it doesn't exist
        await namespaceService.createNamespaceIfNotExists(this.SYSTEM_UPGRADE_NAMESPACE);

        // Fetch and apply the CRD manifest
        console.log('Fetching and applying CRD manifest...');
        await this.applyManifestFromUrl(this.SYSTEM_UPGRADE_CRD_URL);

        // Fetch and apply the system-upgrade-controller manifest
        console.log('Fetching and applying system-upgrade-controller manifest...');
        await this.applyManifestFromUrl(this.SYSTEM_UPGRADE_CONTROLLER_URL);
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

        const kc = k3s.getKubeConfig();
        const specs = k8s.loadAllYaml(yamlContent);

        // Apply each resource
        for (const spec of specs) {
            await this.applyResource(kc, spec);
        }
    }

    /**
     * Applies a single Kubernetes resource to the cluster
     * @param kc KubeConfig instance
     * @param spec Resource specification
     */
    private async applyResource(kc: k8s.KubeConfig, spec: any): Promise<void> {
        if (!spec || !spec.kind) {
            console.error('Invalid resource specification:', spec);
            throw new Error('Invalid resource specification');
        }

        const namespace = spec.metadata?.namespace || this.SYSTEM_UPGRADE_NAMESPACE;
        const name = spec.metadata?.name;

        console.log(`Applying ${spec.kind}/${name} to namespace ${namespace}`);

        try {
            const client = k8s.KubernetesObjectApi.makeApiClient(kc);

            try {
                await client.read(spec);
                // If it exists, patch it
                await client.patch(spec);
                console.log(`Updated ${spec.kind}/${name}`);
            } catch (error) {
                await client.create(spec);
                console.log(`Created ${spec.kind}/${name}`);
            }
        } catch (error) {
            console.error(`Failed to apply ${spec.kind}/${name}:`, error);
            throw error;
        }
    }
}

const k3sUpdateService = new K3sUpdateService();
export default k3sUpdateService;