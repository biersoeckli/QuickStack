import { unstable_cache } from "next/cache";
import quickStackService from "../qs.service";
import { githubAdapter } from "../../adapter/github.adapter";
import { Tags } from "../../utils/cache-tag-generator.utils";
import k3s from "../../adapter/kubernetes-api.adapter";
import namespaceService from "../namespace.service";
import * as k8s from '@kubernetes/client-node';
import { ServiceException } from "@/shared/model/service.exception.model";
import clusterService from "../cluster.service";
import { K3sVersionUtils } from '@/server/utils/k3s-version.utils';
import { qsVersionInfoAdapter } from "../../adapter/qs-versioninfo.adapter";
import paramService, { ParamService } from "../param.service";

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

        await namespaceService.createNamespaceIfNotExists(this.SYSTEM_UPGRADE_NAMESPACE);

        console.log('Fetching and applying CRD manifest...');
        await this.applyManifestFromUrl(this.SYSTEM_UPGRADE_CRD_URL);

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

        const specs = k8s.loadAllYaml(yamlContent);

        // Apply each resource
        for (const spec of specs) {
            await k3s.applyResource(spec, this.SYSTEM_UPGRADE_NAMESPACE);
        }
    }

    async getCurrentK3sMinorVersion() {
        const nodes = await clusterService.getNodeInfo();
        // check if all k3s versions are the same --> otherwise upgrade may be in progress or cluster is in inconsistent state
        const uniqueVersions = Array.from(new Set(nodes.map(n => n.kubeletVersion)));
        if (uniqueVersions.length !== 1) {
            throw new ServiceException('Not all nodes have the same K3s version installed. Maybe a update is currently in progress. Cannot perform any upgrade operations.');
        }
        return K3sVersionUtils.getMinorVersion(uniqueVersions[0]);
    }

    async getVersionInfoForCurrentK3sVersion() {
        const currentMinorVersion = await this.getCurrentK3sMinorVersion();
        const versionInfo = await this.getVersionInfoForCurrentChannel();
        const matchingChannel = versionInfo.find(channel => channel.version === currentMinorVersion);
        if (!matchingChannel) {
            throw new ServiceException(`No matching release channel found for current K3s version ${currentMinorVersion}`);
        }
        return matchingChannel;
    }

    async getNextAvailableK3sReleaseVersionInfo() {
        const currentMinorVersion = await this.getCurrentK3sMinorVersion();
        const versionInfo = await this.getVersionInfoForCurrentChannel();

        const currentUpgradePlan = await this.getCurrentUpgradePlans();
        if (!currentUpgradePlan) {
            // there are currently no upgrade plans installed --> return the current release channel to install the latest path version of the current minor version
            return versionInfo
                .find(channel => channel.version === currentMinorVersion);
        }

        // find the next higher version
        const sortedChannels = versionInfo
            .filter(channel => channel.version > currentMinorVersion); // sorting is already correctly provded by the adapter / API source
        if (sortedChannels.length === 0) {
            return undefined;
        }
        return sortedChannels[0];
    }

    private async getVersionInfoForCurrentChannel() {
        const useCanary = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false)
        if (useCanary) {
            return await qsVersionInfoAdapter.getCanaryK3sReleaseInfo();
        }
        return await qsVersionInfoAdapter.getProdK3sReleaseInfo();
    }

    /**
     * Gets the current upgrade plans (server-plan and agent-plan) from the cluster
     * @returns Object with serverPlan and agentPlan, or undefined if plans don't exist
     */
    async getCurrentUpgradePlans(): Promise<{ serverPlan: any; agentPlan: any } | undefined> {
        try {
            const kc = k3s.getKubeConfig();
            const client = k8s.KubernetesObjectApi.makeApiClient(kc);

            const serverPlanSpec = {
                apiVersion: 'upgrade.cattle.io/v1',
                kind: 'Plan',
                metadata: {
                    name: 'server-plan',
                    namespace: this.SYSTEM_UPGRADE_NAMESPACE
                }
            };

            const agentPlanSpec = {
                apiVersion: 'upgrade.cattle.io/v1',
                kind: 'Plan',
                metadata: {
                    name: 'agent-plan',
                    namespace: this.SYSTEM_UPGRADE_NAMESPACE
                }
            };

            try {
                const [serverPlan, agentPlan] = await Promise.all([
                    client.read(serverPlanSpec),
                    client.read(agentPlanSpec)
                ]);

                return {
                    serverPlan: serverPlan.body,
                    agentPlan: agentPlan.body
                };
            } catch (error) {
                // Plans don't exist
                return undefined;
            }
        } catch (error) {
            console.error('Error fetching upgrade plans:', error);
            return undefined;
        }
    }

    /**
     * Checks if a plan has completed successfully
     * @param plan The upgrade plan to check
     * @returns true if the plan has a Complete condition with status "True"
     */
    private isPlanCompleted(plan: any): boolean {
        if (!plan?.status?.conditions || !Array.isArray(plan.status.conditions)) {
            return false;
        }

        const completeCondition = plan.status.conditions.find(
            (condition: any) => condition.type === 'Complete'
        );

        return completeCondition?.status === 'True';
    }

    /**
     * Determines if a K3s upgrade is currently in progress
     * @returns true if an upgrade is in progress, false otherwise
     *
     * An upgrade is considered in progress if:
     * - No upgrade plans exist (no upgrade has been initiated)
     * - Either the server-plan or agent-plan is not completed
     */
    async isUpgradeInProgress(): Promise<boolean> {
        const plans = await this.getCurrentUpgradePlans();

        // No plans exist - no upgrade in progress
        if (!plans) {
            return false;
        }

        // Check if both plans are completed
        const serverPlanCompleted = this.isPlanCompleted(plans.serverPlan);
        const agentPlanCompleted = this.isPlanCompleted(plans.agentPlan);

        // If either plan is not completed, upgrade is in progress
        return !serverPlanCompleted || !agentPlanCompleted;
    }

    /**
     * Creates upgrade plans for control-plane and worker nodes to upgrade to the next available K3s version calculated by getNextAvailableK3sReleaseVersionInfo.
     * This function triggers the start of the upgrade progress.
     * If upgrade plans already exist, they will be deleted first.
     */
    async createUpgradePlans(): Promise<void> {
        if (!await this.isSystemUpgradeControllerPresent()) {
            throw new ServiceException('System Upgrade Controller must be installed before creating upgrade plans.');
        }

        const versionInfo = await this.getNextAvailableK3sReleaseVersionInfo();
        if (!versionInfo) {
            throw new ServiceException('No next available K3s version found for upgrade.');
        }

        const channelUrl = versionInfo.channelUrl;

        // Delete existing plans if they exist
        await this.deleteUpgradePlans();

        // Server Plan - upgrades control-plane nodes
        const serverPlan = {
            apiVersion: 'upgrade.cattle.io/v1',
            kind: 'Plan',
            metadata: {
                name: 'server-plan',
                namespace: this.SYSTEM_UPGRADE_NAMESPACE
            },
            spec: {
                concurrency: 1,
                cordon: true,
                nodeSelector: {
                    matchExpressions: [
                        {
                            key: 'node-role.kubernetes.io/control-plane',
                            operator: 'In',
                            values: ['true']
                        }
                    ]
                },
                serviceAccountName: 'system-upgrade',
                upgrade: {
                    image: 'rancher/k3s-upgrade'
                },
                channel: channelUrl
            }
        };

        // Agent Plan - upgrades worker nodes
        const agentPlan = {
            apiVersion: 'upgrade.cattle.io/v1',
            kind: 'Plan',
            metadata: {
                name: 'agent-plan',
                namespace: this.SYSTEM_UPGRADE_NAMESPACE
            },
            spec: {
                concurrency: 1,
                cordon: true,
                nodeSelector: {
                    matchExpressions: [
                        {
                            key: 'node-role.kubernetes.io/control-plane',
                            operator: 'DoesNotExist'
                        }
                    ]
                },
                prepare: {
                    args: ['prepare', 'server-plan'],
                    image: 'rancher/k3s-upgrade'
                },
                serviceAccountName: 'system-upgrade',
                upgrade: {
                    image: 'rancher/k3s-upgrade'
                },
                channel: channelUrl
            }
        };

        console.log('Creating server-plan...');
        await k3s.applyResource(serverPlan, this.SYSTEM_UPGRADE_NAMESPACE);

        console.log('Creating agent-plan...');
        await k3s.applyResource(agentPlan, this.SYSTEM_UPGRADE_NAMESPACE);

        console.log('Upgrade plans created successfully');
    }

    async deleteUpgradePlans(): Promise<void> {
        const plans = await this.getCurrentUpgradePlans();

        if (!plans) {
            // No plans to delete
            return;
        }

        const kc = k3s.getKubeConfig();
        const client = k8s.KubernetesObjectApi.makeApiClient(kc);

        console.log('Deleting existing upgrade plans...');

        if (plans.agentPlan) {
            // Delete agent-plan first (it depends on server-plan)
            await client.delete({
                apiVersion: 'upgrade.cattle.io/v1',
                kind: 'Plan',
                metadata: {
                    name: 'agent-plan',
                    namespace: this.SYSTEM_UPGRADE_NAMESPACE
                }
            });
            console.log('Deleted agent-plan');
        }

        if (plans.serverPlan) {
            // Delete server-plan
            await client.delete({
                apiVersion: 'upgrade.cattle.io/v1',
                kind: 'Plan',
                metadata: {
                    name: 'server-plan',
                    namespace: this.SYSTEM_UPGRADE_NAMESPACE
                }
            });
            console.log('Deleted server-plan');
        }
    }
}

const k3sUpdateService = new K3sUpdateService();
export default k3sUpdateService;