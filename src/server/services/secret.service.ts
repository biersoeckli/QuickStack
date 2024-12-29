import { V1Secret } from "@kubernetes/client-node";
import k3s from "../adapter/kubernetes-api.adapter";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";

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

        const existingSecret = await this.getExistingSecret(namespace, app.id);
        if (existingSecret) {
            console.log(`Updating existing Docker registry secret ${secretName}...`);
            await k3s.core.replaceNamespacedSecret(secretName, namespace, secretManifest);
        } else {
            console.log(`Creating new Docker registry secret ${secretName}...`);
            await k3s.core.createNamespacedSecret(namespace, secretManifest);
        }
        return secretName;
    }

    async delteUnusedSecrets(app: AppExtendedModel) {
        if (this.appNeedsNoSecret(app)) {
            const existingSecret = await this.getExistingSecret(app.projectId, app.id);
            if (existingSecret) {
                console.log(`Deleting secret ${existingSecret.metadata?.name}...`);
                await k3s.core.deleteNamespacedSecret(existingSecret.metadata?.name!, app.projectId);
            }
        }
    }

    private appNeedsNoSecret(app: { id: string; name: string; appType: string; projectId: string; sourceType: string; dockerfilePath: string; replicas: number; envVars: string; createdAt: Date; updatedAt: Date; project: { id: string; name: string; createdAt: Date; updatedAt: Date; }; appDomains: { id: string; createdAt: Date; updatedAt: Date; hostname: string; port: number; useSsl: boolean; redirectHttps: boolean; appId: string; }[]; appVolumes: { id: string; createdAt: Date; updatedAt: Date; appId: string; containerMountPath: string; size: number; accessMode: string; }[]; appPorts: { id: string; createdAt: Date; updatedAt: Date; port: number; appId: string; }[]; appFileMounts: { id: string; createdAt: Date; updatedAt: Date; appId: string; containerMountPath: string; content: string; }[]; containerImageSource?: string | null | undefined; containerRegistryUsername?: string | null | undefined; containerRegistryPassword?: string | null | undefined; gitUrl?: string | null | undefined; gitBranch?: string | null | undefined; gitUsername?: string | null | undefined; gitToken?: string | null | undefined; memoryReservation?: number | null | undefined; memoryLimit?: number | null | undefined; cpuReservation?: number | null | undefined; cpuLimit?: number | null | undefined; }) {
        return app.sourceType === 'GIT' || !app.containerImageSource || !app.containerRegistryUsername || !app.containerRegistryPassword;
    }

    async getExistingSecret(namespace: string, appId: string) {
        const existingSecrets = await k3s.core.listNamespacedSecret(namespace);
        const existingSecret = existingSecrets.body.items.find(s => s.metadata?.name === KubeObjectNameUtils.toSecretId(appId));
        return existingSecret;
    }
}

const secretService = new SecretService();
export default secretService;