import { KubernetesResource } from "@/shared/model/base-kubernetes-object";
import k3s from "./kubernetes-api.adapter";
import { ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "@/shared/utils/constants";
import { V1ObjectMeta, V1Secret } from "@kubernetes/client-node";

export interface SandboxTemplateSpec {
    name: string;
    namespace: string;
    image: string;
    command?: string[];
    args?: string[];
    env?: { name: string; value: string }[];
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
}

export interface SandboxWarmPoolSpec {
    name: string;
    namespace: string;
    templateName: string;
    replicas: number;
}

export interface SandboxClaimSpec {
    name: string;
    namespace: string;
    warmPoolName: string;
    labels?: Record<string, string>;
}

const SANDBOX_API_GROUP = 'extensions.agents.x-k8s.io';
const SANDBOX_API_VERSION = 'v1beta1';
const TEMPLATE_PLURAL = 'sandboxtemplates';
const WARMPOOL_PLURAL = 'sandboxwarmpools';
const CLAIM_PLURAL = 'sandboxclaims';

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

    async getSandboxTemplate(name: string, namespace: string): Promise<KubernetesResource> {
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
     */
    async reconcileSandboxTemplate(spec: SandboxTemplateSpec): Promise<void> {
        const resource: KubernetesResource = {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxTemplate',
            metadata: {
                name: spec.name,
                namespace: spec.namespace,
                annotations: {
                    [Constants.QS_ANNOTATION_UPDATED_AT]: `${new Date().toISOString()}`,
                }
            },
            spec: {
                podTemplate: {
                    spec: {
                        containers: [{
                            name: 'agent',
                            image: spec.image,
                            ...(spec.command ? { command: spec.command } : {}),
                            ...(spec.args ? { args: spec.args } : {}),
                            ...(spec.env ? { env: spec.env } : {}),
                            resources: {
                                requests: {
                                    cpu: spec.cpuRequest,
                                    memory: spec.memoryRequest,
                                },
                                limits: {
                                    cpu: spec.cpuLimit,
                                    memory: spec.memoryLimit,
                                },
                            },
                        }],
                    },
                },
            },
        };

        try {
            await this.applyCustomResource(resource, spec.namespace, TEMPLATE_PLURAL);
        } catch (error: any) {
            console.error(`Failed to reconcile SandboxTemplate "${spec.name}":`, error);
            throw new ServiceException(
                `Failed to reconcile SandboxTemplate "${spec.name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Creates or updates a SandboxWarmPool custom resource.
     */
    async reconcileSandboxWarmPool(spec: SandboxWarmPoolSpec): Promise<void> {
        const resource: KubernetesResource = {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxWarmPool',
            metadata: {
                name: spec.name,
                namespace: spec.namespace,
                annotations: {
                    [Constants.QS_ANNOTATION_UPDATED_AT]: `${new Date().getTime()}`,
                }
            },
            spec: {
                sandboxTemplateRef: {
                    name: spec.templateName,
                },
                replicas: spec.replicas,
            },
        };

        try {
            await this.applyCustomResource(resource, spec.namespace, WARMPOOL_PLURAL);
        } catch (error: any) {
            throw new ServiceException(
                `Failed to reconcile SandboxWarmPool "${spec.name}": ${error?.message || error}`,
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
    ): Promise<KubernetesResource[]> {
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

    async createSandboxClaim(spec: SandboxClaimSpec): Promise<void> {
        const resource: KubernetesResource = {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxClaim',
            metadata: {
                name: spec.name,
                namespace: spec.namespace,
                ...(spec.labels ? { labels: spec.labels } : {}),
            },
            spec: {
                warmPoolRef: {
                    name: spec.warmPoolName,
                }
            },
        };

        try {
            await k3s.customObjects.getNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                spec.namespace,
                CLAIM_PLURAL,
                spec.name,
            );
            throw new ServiceException(
                `SandboxClaim "${spec.name}" already exists. Stop the Agent before starting again.`,
            );
        } catch (error: any) {
            if (error instanceof ServiceException) {
                throw error;
            }
            if (error?.response?.statusCode !== 404) {
                throw new ServiceException(
                    `Failed to check existing SandboxClaim "${spec.name}": ${error?.message || error}`,
                );
            }
        }

        try {
            await k3s.customObjects.createNamespacedCustomObject(
                SANDBOX_API_GROUP,
                SANDBOX_API_VERSION,
                spec.namespace,
                CLAIM_PLURAL,
                resource,
            );
        } catch (error: any) {
            console.error(`Failed to create SandboxClaim "${spec.name}":`, error);
            throw new ServiceException(
                `Failed to create SandboxClaim "${spec.name}": ${error?.message || error}`,
            );
        }
    }

    async getSandboxClaim(name: string, namespace: string): Promise<KubernetesResource | null> {
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

    async createOrReplaceSecret(name: string, namespace: string, data: Record<string, string>): Promise<void> {
        const base64Data: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
            base64Data[key] = Buffer.from(value).toString('base64');
        }

        const secretManifest: V1Secret = {
            metadata: { name },
            data: base64Data,
        };

        try {
            const existingResponse = await k3s.core.readNamespacedSecret(name, namespace);
            secretManifest.metadata!.resourceVersion = existingResponse.body.metadata?.resourceVersion;
            await k3s.core.replaceNamespacedSecret(name, namespace, secretManifest);
        } catch (error: any) {
            if (error?.response?.statusCode !== 404) {
                throw new ServiceException(
                    `Failed to read Secret "${name}": ${error?.message || error}`,
                );
            }
            await k3s.core.createNamespacedSecret(namespace, secretManifest);
        }
    }

    async getSecret(name: string, namespace: string): Promise<Record<string, string> | null> {
        try {
            const response = await k3s.core.readNamespacedSecret(name, namespace);
            const data = response.body.data || {};
            const decoded: Record<string, string> = {};
            for (const [key, value] of Object.entries(data)) {
                decoded[key] = value ? Buffer.from(value, 'base64').toString('utf-8') : '';
            }
            return decoded;
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return null;
            }
            throw new ServiceException(
                `Failed to read Secret "${name}": ${error?.message || error}`,
            );
        }
    }

    async deleteSecret(name: string, namespace: string): Promise<void> {
        try {
            await k3s.core.deleteNamespacedSecret(name, namespace);
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return;
            }
            throw new ServiceException(
                `Failed to delete Secret "${name}": ${error?.message || error}`,
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
            const conditions: Array<{ type: string; status: string; message?: string; reason?: string }> =
                claim?.status?.conditions || [];

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
     * Applies a custom resource (create or patch) using the Kubernetes API.
     */
    private async applyCustomResource(
        resource: KubernetesResource,
        namespace: string,
        plural: string,
    ): Promise<void> {
        const name = resource.metadata.name!;

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
                throw error;
            }
        }
    }
}

const agentSandboxAdapter = new AgentSandboxAdapter();
export default agentSandboxAdapter;
