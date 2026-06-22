import k3s from "./kubernetes-api.adapter";
import { ServiceException } from "@/shared/model/service.exception.model";

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

const SANDBOX_API_GROUP = 'sandbox.quickstack.dev';
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
        } catch {
            return false;
        }
    }

    /**
     * Creates or updates a SandboxTemplate custom resource.
     */
    async reconcileSandboxTemplate(spec: SandboxTemplateSpec): Promise<void> {
        const resource = {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxTemplate',
            metadata: {
                name: spec.name,
                namespace: spec.namespace,
            },
            spec: {
                image: spec.image,
                command: spec.command || [],
                args: spec.args || [],
                env: spec.env || [],
                resources: {
                    requests: {
                        cpu: spec.cpuRequest || '100m',
                        memory: spec.memoryRequest || '128Mi',
                    },
                    limits: {
                        cpu: spec.cpuLimit || '500m',
                        memory: spec.memoryLimit || '512Mi',
                    },
                },
            },
        };

        try {
            await this.applyCustomResource(resource, spec.namespace, TEMPLATE_PLURAL);
        } catch (error: any) {
            throw new ServiceException(
                `Failed to reconcile SandboxTemplate "${spec.name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Creates or updates a SandboxWarmPool custom resource.
     */
    async reconcileSandboxWarmPool(spec: SandboxWarmPoolSpec): Promise<void> {
        const resource = {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxWarmPool',
            metadata: {
                name: spec.name,
                namespace: spec.namespace,
            },
            spec: {
                templateRef: {
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
     * Applies a custom resource (create or patch) using the Kubernetes API.
     */
    private async applyCustomResource(
        resource: any,
        namespace: string,
        plural: string,
    ): Promise<void> {
        const name = resource.metadata.name;

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
