import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Ingress, V1Secret } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Constants } from "../../shared/utils/constants";
import ingressSetupService from "./setup-services/ingress-setup.service";
import { dlog } from "./deployment-logs.service";
import { createHash } from "crypto";
import { CryptoUtils } from "../utils/crypto.utils";

class IngressService {

    async getAllIngressForApp(projectId: string, appId: string) {
        const res = await k3s.network.listNamespacedIngress(projectId);
        return res.body.items.filter((item) => item.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID] === appId);
    }

    async getIngressByName(projectId: string, domainId: string) {
        const res = await k3s.network.listNamespacedIngress(projectId);
        return res.body.items.find((item) => item.metadata?.name === KubeObjectNameUtils.getIngressName(domainId));
    }

    async deleteUnusedIngressesOfApp(app: AppExtendedModel) {
        const currentDomains = new Set(app.appDomains.map(domainObj => domainObj.hostname));
        const existingIngresses = await this.getAllIngressForApp(app.projectId, app.id);

        if (currentDomains.size === 0) {
            for (const ingress of existingIngresses) {
                await k3s.network.deleteNamespacedIngress(ingress.metadata!.name!, app.projectId);
                console.log(`Deleted Ingress ${ingress.metadata!.name} for app ${app.id}`);
            }
        } else {
            for (const ingress of existingIngresses) {
                const ingressDomain = ingress.spec?.rules?.[0]?.host;

                if (ingressDomain && !currentDomains.has(ingressDomain)) {
                    await k3s.network.deleteNamespacedIngress(ingress.metadata!.name!, app.projectId);
                    console.log(`Deleted Ingress ${ingress.metadata!.name} for domain ${ingressDomain}`);
                }
            }
        }
    }

    async deleteAllIngressForApp(projectId: string, appId: string) {
        const existingIngresses = await this.getAllIngressForApp(projectId, appId);
        for (const ingress of existingIngresses) {
            await k3s.network.deleteNamespacedIngress(ingress.metadata!.name!, projectId);
            console.log(`Deleted Ingress ${ingress.metadata!.name} for app ${appId}`);
        }
    }

    async createOrUpdateIngressForApp(deploymentId: string, app: AppExtendedModel) {

        await ingressSetupService.createTraefikRedirectMiddlewareIfNotExist();
        const basicAuthMiddlewareName = await this.configureBasicAuthForApp(app);
        for (const domainObj of app.appDomains) {
            await this.createOrUpdateIngress(deploymentId, app, domainObj, basicAuthMiddlewareName);
        }
        await this.deleteUnusedBasicAuthMiddlewaresForApp(app);
        await this.deleteUnusedIngressesOfApp(app);
    }

    async createOrUpdateIngress(deploymentId: string,
        app: { id: string, projectId: string },
        domain: { id: string, hostname: string, port: number, useSsl: boolean, redirectHttps: boolean },
        basicAuthMiddlewareName?: string) {
        const hostname = domain.hostname;
        const ingressName = KubeObjectNameUtils.getIngressName(domain.id);
        const existingIngress = await this.getIngressByName(app.projectId, domain.id);

        const middlewares = [
            basicAuthMiddlewareName,
            (domain.useSsl && domain.redirectHttps) ? 'kube-system-redirect-to-https@kubernetescrd' : undefined,
        ].filter((middleware) => !!middleware).join(',') ?? undefined;

        const ingressDefinition: V1Ingress = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: ingressName,
                namespace: app.projectId,
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: app.id,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
                    ...(domain.useSsl === true && { 'cert-manager.io/cluster-issuer': 'letsencrypt-production' }),
                    ...(middlewares && { 'traefik.ingress.kubernetes.io/router.middlewares': middlewares }),
                    ...(domain.useSsl === false && { 'traefik.ingress.kubernetes.io/router.entrypoints': 'web' }), // disable requests from https --> only http
                },
            },
            spec: {
                ingressClassName: 'traefik',
                rules: [
                    {
                        host: hostname,
                        http: {
                            paths: [
                                {
                                    path: '/',
                                    pathType: 'Prefix',
                                    backend: {
                                        service: {
                                            name: KubeObjectNameUtils.toServiceName(app.id),
                                            port: {
                                                number: domain.port,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
                ...(domain.useSsl === true && {
                    tls: [
                        {
                            hosts: [hostname],
                            secretName: `secret-tls-${domain.id}`,
                        },
                    ],
                }),
            },
        };

        await dlog(deploymentId, `Configuring Ingress with Domain ${domain.useSsl ? 'https' : 'http'}://${hostname} --> ${app.id}:${domain.port}`);
        if (existingIngress) {
            await k3s.network.replaceNamespacedIngress(ingressName, app.projectId, ingressDefinition);
            console.log(`Ingress ${ingressName} for domain ${hostname} successfully updated.`);
        } else {
            await k3s.network.createNamespacedIngress(app.projectId, ingressDefinition);
            console.log(`Ingress ${ingressName} for domain ${hostname} successfully created.`);
        }
    }

    async configureBasicAuthForApp(app: AppExtendedModel) {
        if (!app.appBasicAuths || app.appBasicAuths.length === 0) {
            return undefined;
        }
        return await this.configureBasicAuthMiddleware(app.projectId, app.id, app.appBasicAuths.map(basicAuth => [basicAuth.username, basicAuth.password]));
    }

    async deleteUnusedBasicAuthMiddlewaresForApp(app: AppExtendedModel) {
        if (!app.appBasicAuths || app.appBasicAuths.length > 0) {
            return;
        }

        await this.deleteUnusedBasicAuthMiddlewares(app.projectId, app.id);
    }

    async deleteUnusedBasicAuthMiddlewares(namespace: string, basicAuthId: string) {

        // delete middleware
        const middlewareName = `ba-${basicAuthId}`;
        const existingMiddlewares = await k3s.customObjects.listNamespacedCustomObject('traefik.io',            // group
            'v1alpha1',              // version
            namespace,        // namespace
            'middlewares'            // plural name of the custom resource
        );
        const existingBasicAuthMiddleware = (existingMiddlewares.body as any).items.find((item: any) => item.metadata?.name === middlewareName);
        if (existingBasicAuthMiddleware) {
            await k3s.customObjects.deleteNamespacedCustomObject('traefik.io', 'v1alpha1', namespace, 'middlewares', middlewareName);
        }

        // delete traefik basic auth secret
        const secretName = `bas-${basicAuthId}`;
        const existingSecrets = await k3s.core.listNamespacedSecret(namespace);
        const existingSecret = existingSecrets.body.items.find((item) => item.metadata?.name === secretName);
        if (existingSecret) {
            await k3s.core.deleteNamespacedSecret(secretName, namespace);
        }

        // delete plaintext credentials secret
        const plaintextSecretName = `bas-plain-${basicAuthId}`;
        const existingPlaintextSecret = existingSecrets.body.items.find((item) => item.metadata?.name === plaintextSecretName);
        if (existingPlaintextSecret) {
            await k3s.core.deleteNamespacedSecret(plaintextSecretName, namespace);
        }
    }

    /**
     * Reads plaintext credentials from a separate bas-plain-{id} secret created alongside the basic auth middleware.
     * @returns { username, password } or undefined if not present
     */
    async getPlaintextCredentialsFromSecret(namespace: string, basicAuthId: string): Promise<{ username: string; password: string } | undefined> {
        const plaintextSecretName = `bas-plain-${basicAuthId}`;
        const existingSecrets = await k3s.core.listNamespacedSecret(namespace);
        const secret = existingSecrets.body.items.find((item) => item.metadata?.name === plaintextSecretName);
        if (!secret?.data) return undefined;
        const usernameB64 = secret.data['username'];
        const passwordB64 = secret.data['password'];
        if (!usernameB64 || !passwordB64) return undefined;
        return {
            username: Buffer.from(usernameB64, 'base64').toString('utf-8'),
            password: CryptoUtils.decrypt(Buffer.from(passwordB64, 'base64').toString('utf-8')),
        };
    }

    /**
     * Configures a basic auth middleware in a namespace.
     * @param storeCredentialsSeparately When true, also stores plainUsername and encryptet plainPassword in the secret for later retrieval.
     * @returns middleware name for annotation in ingress controller
     */
    async configureBasicAuthMiddleware(namespace: string, basicAuthId: string, usernamePassword: [string, string][], storeCredentialsSeparately = false) {

        const basicAuthNameMiddlewareName = `ba-${basicAuthId}`; // basic auth middleware
        const basicAuthSecretName = `bas-${basicAuthId}`; // basic auth secret

        const secretNamespace = namespace;
        const middlewareNamespace = namespace;

        // Create a secret with basic auth users
        const existingSecrets = await k3s.core.listNamespacedSecret(secretNamespace);
        const existingSecret = existingSecrets.body.items.find((item) => item.metadata?.name === basicAuthSecretName);

        const usernameAndSha1PasswordStrings = usernamePassword.map(([username, password]) => `${username}:{SHA}${createHash('sha1').update(password).digest('base64')}`);

        // Traefik requires the secret to contain only the `users` field
        const secretManifest: V1Secret = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: basicAuthSecretName,
                namespace: secretNamespace,
            },
            data: {
                users: Buffer.from(usernameAndSha1PasswordStrings.join('\n')).toString('base64')
            }
        };

        if (existingSecret) {
            await k3s.core.deleteNamespacedSecret(basicAuthSecretName, secretNamespace);
        }
        await k3s.core.createNamespacedSecret(
            secretNamespace,       // namespace
            secretManifest          // object manifest
        );

        // Store plaintext credentials in a separate secret so they can be displayed to the user
        if (storeCredentialsSeparately && usernamePassword.length > 0) {
            const plaintextSecretName = `bas-plain-${basicAuthId}`;
            const existingPlaintextSecret = existingSecrets.body.items.find((item) => item.metadata?.name === plaintextSecretName);
            const plaintextSecretManifest: V1Secret = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: plaintextSecretName,
                    namespace: secretNamespace,
                },
                data: {
                    username: Buffer.from(usernamePassword[0][0]).toString('base64'),
                    password: Buffer.from(CryptoUtils.encrypt(usernamePassword[0][1])).toString('base64')
                }
            };
            if (existingPlaintextSecret) {
                await k3s.core.deleteNamespacedSecret(plaintextSecretName, secretNamespace);
            }
            await k3s.core.createNamespacedSecret(secretNamespace, plaintextSecretManifest);
        }

        // Create a middleware with basic auth
        const existingBasicAuthMiddlewares = await k3s.customObjects.listNamespacedCustomObject('traefik.io',            // group
            'v1alpha1',              // version
            middlewareNamespace,        // namespace
            'middlewares'            // plural name of the custom resource
        );
        const existingBasicAuthMiddleware = (existingBasicAuthMiddlewares.body as any).items.find((item: any) => item.metadata?.name === basicAuthNameMiddlewareName);

        const middlewareManifest = {
            apiVersion: 'traefik.io/v1alpha1',
            kind: 'Middleware',
            metadata: {
                name: basicAuthNameMiddlewareName,
                namespace: middlewareNamespace,
            },
            spec: {
                basicAuth: {
                    secret: basicAuthSecretName,
                }
            },
        };

        if (existingBasicAuthMiddleware) {
            await k3s.customObjects.deleteNamespacedCustomObject('traefik.io', 'v1alpha1', middlewareNamespace, 'middlewares', basicAuthNameMiddlewareName);
        }
        await k3s.customObjects.createNamespacedCustomObject(
            'traefik.io',           // group
            'v1alpha1',             // version
            middlewareNamespace,    // namespace
            'middlewares',          // plural name of the custom resource
            middlewareManifest      // object manifest
        );

        return `${namespace}-${basicAuthNameMiddlewareName}@kubernetescrd`;
    }
}

const ingressService = new IngressService();
export default ingressService;
