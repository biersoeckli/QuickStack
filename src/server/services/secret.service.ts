import { V1Secret } from "@kubernetes/client-node";
import k3s from "../adapter/kubernetes-api.adapter";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { ServiceException } from "@/shared/model/service.exception.model";

class SecretService {

    async createOrUpdateDockerPullSecret(app: AppExtendedModel) {
        if (this.appNeedsNoSecret(app)) {
            return;
        }
        const dockerImage = app.containerImageSource;
        const dockerUsername = app.containerRegistryUsername;
        const dockerPassword = app.containerRegistryPassword;

        const secretName = KubeObjectNameUtils.toSecretId(app.id);
        const namespace = app.projectId;
        let dockerServer = dockerImage!.split("/")[0];

        // if no registry url is provided, use Docker Hub
        if (!dockerServer.includes('.')) {
            dockerServer = 'https://index.docker.io/v2/';
        }

        // Create a Docker registry secret
        const dockerConfigJson = {
            auths: {
                [dockerServer]: {
                    username: dockerUsername,
                    password: dockerPassword,
                    //email: dockerEmail,
                    auth: Buffer.from(`${dockerUsername}:${dockerPassword}`).toString('base64'),
                },
            },
        };

        const secretManifest: V1Secret = {
            metadata: {
                name: secretName,
            },
            data: {
                '.dockerconfigjson': Buffer.from(JSON.stringify(dockerConfigJson)).toString('base64'),
            },
            type: 'kubernetes.io/dockerconfigjson',
        };

        await this.saveSecret(namespace, secretName, secretManifest);
        return secretName;
    }

    async deleteUnusedSecrets(app: AppExtendedModel) {
        if (this.appNeedsNoSecret(app)) {
            const existingSecret = await this.getExistingSecret(app.projectId, KubeObjectNameUtils.toSecretId(app.id));
            if (existingSecret) {
                console.log(`Deleting secret ${existingSecret.metadata?.name}...`);
                await this.deleteSecret(app.projectId, existingSecret.metadata?.name!);
            }
        }
    }

    private appNeedsNoSecret(app: { id: string; name: string; appType: string; projectId: string; sourceType: string; dockerfilePath: string; replicas: number; envVars: string; createdAt: Date; updatedAt: Date; project: { id: string; name: string; createdAt: Date; updatedAt: Date; }; appDomains: { id: string; createdAt: Date; updatedAt: Date; hostname: string; port: number; useSsl: boolean; redirectHttps: boolean; appId: string; }[]; appVolumes: { id: string; createdAt: Date; updatedAt: Date; appId: string; containerMountPath: string; size: number; accessMode: string; storageClassName: string; }[]; appPorts: { id: string; createdAt: Date; updatedAt: Date; port: number; appId: string; }[]; appFileMounts: { id: string; createdAt: Date; updatedAt: Date; appId: string; containerMountPath: string; content: string; }[]; containerImageSource?: string | null | undefined; containerRegistryUsername?: string | null | undefined; containerRegistryPassword?: string | null | undefined; gitUrl?: string | null | undefined; gitBranch?: string | null | undefined; gitUsername?: string | null | undefined; gitToken?: string | null | undefined; memoryReservation?: number | null | undefined; memoryLimit?: number | null | undefined; cpuReservation?: number | null | undefined; cpuLimit?: number | null | undefined; }) {
        return app.sourceType === 'GIT' || app.sourceType === 'GIT_SSH' || !app.containerImageSource || !app.containerRegistryUsername || !app.containerRegistryPassword;
    }

    async createSecret(namespace: string, secretManifest: V1Secret) {
        const secretName = secretManifest.metadata?.name;
        if (!secretName) {
            throw new Error('Secret name is required.');
        }
        console.log(`Creating secret ${secretName}...`);
        await k3s.core.createNamespacedSecret(namespace, secretManifest);
    }

    async updateSecret(namespace: string, secretName: string, secretManifest: V1Secret) {
        console.log(`Updating secret ${secretName}...`);
        await k3s.core.replaceNamespacedSecret(secretName, namespace, secretManifest);
    }

    async saveSecret(namespace: string, secretName: string, secretManifest: V1Secret) {
        const existingSecret = await this.getExistingSecret(namespace, secretName);
        if (existingSecret) {
            await this.updateSecret(namespace, secretName, secretManifest);
        } else {
            await this.createSecret(namespace, secretManifest);
        }
    }

    async deleteSecret(namespace: string, secretName: string) {
        await k3s.core.deleteNamespacedSecret(secretName, namespace);
    }

    async deleteSecretIfExists(namespace: string, secretName?: string) {
        if (!secretName) {
            return;
        }
        const existingSecret = await this.getExistingSecret(namespace, secretName);
        if (existingSecret) {
            console.log(`Deleting secret ${secretName}...`);
            await this.deleteSecret(namespace, secretName);
        }
    }

    async getExistingSecret(namespace: string, secretName: string) {
        const existingSecrets = await k3s.core.listNamespacedSecret(namespace);
        const existingSecret = existingSecrets.body.items.find(s => s.metadata?.name === secretName);
        return existingSecret;
    }

    /**
     * Creates or replaces a generic (Opaque) Secret with base64-encoded string data.
     * Does NOT handle 404 on read gracefully — surfaces all non-404 errors.
     */
    async createOrReplaceGenericSecret(
        name: string,
        namespace: string,
        data: Record<string, string>,
    ): Promise<void> {
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
                console.error(`Failed to read Secret "${name}":`, error);
                throw new ServiceException(
                    `Failed to read Secret "${name}": ${error?.message || error}`,
                );
            }
            await k3s.core.createNamespacedSecret(namespace, secretManifest);
        }
    }

    /**
     * Reads a Secret and returns its decoded data as key-value pairs.
     * Returns null when the Secret does not exist (404).
     */
    async getDecodedSecret(name: string, namespace: string): Promise<Record<string, string> | null> {
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
            console.error(`Failed to read Secret "${name}":`, error);
            throw new ServiceException(
                `Failed to read Secret "${name}": ${error?.message || error}`,
            );
        }
    }

    /**
     * Deletes a Secret, silently ignoring 404 (not found).
     */
    async deleteSecretSafe(name: string, namespace: string): Promise<void> {
        try {
            await k3s.core.deleteNamespacedSecret(name, namespace);
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return;
            }
            console.error(`Failed to delete Secret "${name}":`, error);
            throw new ServiceException(
                `Failed to delete Secret "${name}": ${error?.message || error}`,
            );
        }
    }
}

const secretService = new SecretService();
export default secretService;
