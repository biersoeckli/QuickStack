import { KubernetesResource } from "@/shared/model/base-kubernetes-object";
import k3s from "./kubernetes-api.adapter";
import { ServiceException } from "@/shared/model/service.exception.model";
import { SandboxClaim, SandboxTemplate, SandboxWarmPool } from "./api-clients/types/agents.models";

export const SANDBOX_API_GROUP = 'extensions.agents.x-k8s.io';
export const SANDBOX_API_VERSION = 'v1beta1';
export const TEMPLATE_PLURAL = 'sandboxtemplates';
export const WARMPOOL_PLURAL = 'sandboxwarmpools';
export const CLAIM_PLURAL = 'sandboxclaims';

class AgentSandboxAdapter {

    /**
     * Checks whether an active SandboxClaim exists for the given agent.
     * Returns false when the claim does not exist (404) or on any lookup error.
     */
    async hasActiveClaim(name: string, namespace: string): Promise<boolean> {
        try {
            await k3s.customObjects.getNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                name,
            );
            return true;
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return false;
            }
            throw new ServiceException(
                `Failed to check SandboxClaim "${name}": ${error?.message || error}`,
            );
        }
    }

    async getSandboxTemplate(name: string, namespace: string): Promise<SandboxTemplate> {
        try {
            const response = await k3s.customObjects.getNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                TEMPLATE_PLURAL,
                name,
            );
            return (response as any).body;
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                throw new ServiceException(`SandboxTemplate "${name}" not found in namespace "${namespace}".`);
            }
            console.error(`Failed to get SandboxTemplate "${name}":`, error);
            throw new ServiceException(
                `Failed to get SandboxTemplate "${name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Creates or updates a SandboxTemplate custom resource.
     * The caller is responsible for constructing the full KubernetesResource.
     */
    async reconcileSandboxTemplate(resource: SandboxTemplate): Promise<void> {
        this.assertResourceKind(resource, 'SandboxTemplate', TEMPLATE_PLURAL);
        try {
            await this.applyCustomResource(resource, resource.metadata!.namespace!, TEMPLATE_PLURAL);
        } catch (error: any) {
            console.error(`Failed to reconcile SandboxTemplate "${resource.metadata!.name}":`, JSON.stringify(error));
            throw new ServiceException(
                `Failed to reconcile SandboxTemplate "${resource.metadata!.name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Creates or updates a SandboxWarmPool custom resource.
     * The caller is responsible for constructing the full KubernetesResource.
     */
    async reconcileSandboxWarmPool(resource: SandboxWarmPool): Promise<void> {
        this.assertResourceKind(resource, 'SandboxWarmPool', WARMPOOL_PLURAL);
        try {
            await this.applyCustomResource(resource, resource.metadata!.namespace!, WARMPOOL_PLURAL);
        } catch (error: any) {
            console.error(`Failed to reconcile SandboxWarmPool "${resource.metadata!.name}":`, error);
            throw new ServiceException(
                `Failed to reconcile SandboxWarmPool "${resource.metadata!.name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Deletes a SandboxTemplate custom resource.
     */
    async deleteSandboxTemplate(name: string, namespace: string): Promise<void> {
        try {
            await k3s.customObjects.deleteNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                TEMPLATE_PLURAL,
                name,
            );
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return; // Already deleted
            }
            console.error(`Failed to delete SandboxTemplate "${name}":`, error);
            throw new ServiceException(
                `Failed to delete SandboxTemplate "${name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Deletes a SandboxWarmPool custom resource.
     */
    async deleteSandboxWarmPool(name: string, namespace: string): Promise<void> {
        try {
            await k3s.customObjects.deleteNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                WARMPOOL_PLURAL,
                name,
            );
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return; // Already deleted
            }
            console.error(`Failed to delete SandboxWarmPool "${name}":`, error);
            throw new ServiceException(
                `Failed to delete SandboxWarmPool "${name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Lists all SandboxClaims in a namespace, optionally filtered by label selector.
     */
    async listSandboxClaims(
        namespace: string,
        labelSelector?: string,
    ): Promise<SandboxClaim[]> {
        try {
            const response = await k3s.customObjects.listNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                undefined, // pretty
                undefined, // allowWatchBookmarks
                undefined, // continue
                undefined, // fieldSelector
                labelSelector,
            );
            return (response as any).body?.items || [];
        } catch (error: any) {
            console.error(`Failed to list SandboxClaims in namespace "${namespace}":`, error);
            throw new ServiceException(
                `Failed to list SandboxClaims: ${error?.message || error}`,
            );
        }
    }

    /**
     * Creates a SandboxClaim custom resource.
     * The caller is responsible for constructing the full KubernetesResource.
     */
    async createSandboxClaim(resource: SandboxClaim): Promise<void> {
        this.assertResourceKind(resource, 'SandboxClaim', CLAIM_PLURAL);
        const name = resource.metadata!.name!;
        const namespace = resource.metadata!.namespace!;

        try {
            await k3s.customObjects.getNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                name,
            );
            throw new ServiceException(
                `SandboxClaim "${name}" already exists. Stop the Agent before starting again.`,
            );
        } catch (error: any) {
            if (error instanceof ServiceException) {
                throw error;
            }
            console.error(`Failed to check existing SandboxClaim "${name}":`, error);
            if (error?.response?.statusCode !== 404) {
                throw new ServiceException(
                    `Failed to check existing SandboxClaim "${name}": ${error?.message || error}`,
                );
            }
        }

        try {
            await k3s.customObjects.createNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                resource,
            );
        } catch (error: any) {
            console.error(`Failed to create SandboxClaim "${name}":`, error);
            throw new ServiceException(
                `Failed to create SandboxClaim "${name}": ${error?.message || error}`,
            );
        }
    }

    async getSandboxClaim(name: string, namespace: string): Promise<SandboxClaim | null> {
        try {
            const response = await k3s.customObjects.getNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                name,
            );
            return (response as any).body;
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return null;
            }
            console.error(`Failed to get SandboxClaim "${name}":`, error);
            throw new ServiceException(
                `Failed to get SandboxClaim "${name}": ${error?.message || error}`,
            );
        }
    }

    async deleteSandboxClaim(name: string, namespace: string): Promise<void> {
        try {
            await k3s.customObjects.deleteNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                CLAIM_PLURAL,
                name,
            );
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return;
            }
            console.error(`Failed to delete SandboxClaim "${name}":`, error);
            throw new ServiceException(
                `Failed to delete SandboxClaim "${name}": ${error?.message || error}`,
            );
        }
    }

    async waitForSandboxReady(name: string, namespace: string, timeoutMs = 300_000, pollIntervalMs = 2_000): Promise<void> {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const claim = await this.getSandboxClaim(name, namespace);
            if (!claim) {
                throw new ServiceException(`Sandbox Claim "${name}" not found while waiting for readiness.`);
            }
            const claimStatus = claim.status as { conditions?: Array<{ type: string; status: string; message?: string; reason?: string }> } | undefined;
            const conditions = claimStatus?.conditions || [];

            const ready = conditions.find((c) => c.type === 'Ready');
            if (ready?.status === 'True') {
                return;
            }

            const terminalReasons = new Set([
                'ClaimExpired',
                'Expired',
                'InvalidMetadata',
                'ReconcilerError',
                'TemplateNotFound',
                'VolumeClaimTemplatesError',
                'WarmPoolNotFound',
            ]);
            if (ready?.status === 'False' && ready.reason && terminalReasons.has(ready.reason)) {
                throw new ServiceException(
                    `Sandbox "${name}" failed to become ready: ${ready.message || ready.reason}`,
                );
            }

            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        throw new ServiceException(
            `Sandbox "${name}" did not become ready within ${timeoutMs / 1000}s. ` +
            `Check sandbox controller logs and Pod events for details.`,
        );
    }

    /**
     * Validates that the resource has the expected apiVersion and kind.
     */
    private assertResourceKind(
        resource: KubernetesResource,
        expectedKind: string,
        displayName: string,
    ): void {
        const expectedApiVersion = `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`;
        if (resource.apiVersion !== expectedApiVersion) {
            throw new ServiceException(
                `Invalid apiVersion for ${displayName}: expected "${expectedApiVersion}", got "${resource.apiVersion}".`,
            );
        }
        if (resource.kind !== expectedKind) {
            throw new ServiceException(
                `Invalid kind for ${displayName}: expected "${expectedKind}", got "${resource.kind}".`,
            );
        }
    }

    /**
     * Applies a custom resource (create or patch) using the Kubernetes API.
     */
    private async applyCustomResource(
        resource: KubernetesResource,
        namespace: string,
        plural: string,
    ): Promise<void> {
        const name = resource.metadata!.name!;

        try {
            // Try to read existing resource
            await k3s.customObjects.getNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                plural,
                name,
            );
            // Exists — patch it
            await k3s.customObjects.patchNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                namespace,
                plural,
                name,
                resource,
                undefined,
                undefined,
                undefined,
                {
                    headers: { 'Content-Type': 'application/merge-patch+json' },
                },
            );
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                // Does not exist — create it
                await k3s.customObjects.createNamespacedCustomObject(
                    SANDBOX_API_GROUP,
                    SANDBOX_API_VERSION,
                    namespace,
                    plural,
                    resource,
                );
            } else {
                console.error(`Failed to apply custom resource "${name}" in namespace "${namespace}":`, error);
                throw error;
            }
        }
    }
}

const agentSandboxAdapter = new AgentSandboxAdapter();
export default agentSandboxAdapter;
