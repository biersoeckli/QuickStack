import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Ingress, V1Secret } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { AppDomain } from "@prisma/client";
import { Constants } from "../../shared/utils/constants";
import ingressSetupService from "./setup-services/ingress-setup.service";
import { dlog } from "./deployment-logs.service";
import { createHash } from "crypto";
import { HostnameDnsProviderUtils } from "@/shared/utils/domain-dns-provider.utils";

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
        const isATraefikMeDomain = HostnameDnsProviderUtils.isValidDnsProviderHostname(hostname);

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
                    ...(!isATraefikMeDomain && domain.useSsl === true && { 'cert-manager.io/cluster-issuer': 'letsencrypt-production' }), // for traefik.me domains no cert-manager --> uses default traefik self signed certificate
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
                ...(domain.useSsl === true && !isATraefikMeDomain && {
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

        // delete secret
        const secretName = `bas-${basicAuthId}`;
        const existingSecrets = await k3s.core.listNamespacedSecret(namespace);
        const existingSecret = existingSecrets.body.items.find((item) => item.metadata?.name === secretName);
        if (existingSecret) {
            await k3s.core.deleteNamespacedSecret(secretName, namespace);
        }
    }

    /**
     * Configures a basic auth middleware in a namespace.
     * @returns middleware name for annotation in ingress controller
     */
    async configureBasicAuthMiddleware(namespace: string, basicAuthId: string, usernamePassword: [string, string][]) {

        const basicAuthNameMiddlewareName = `ba-${basicAuthId}`; // basic auth middleware
        const basicAuthSecretName = `bas-${basicAuthId}`; // basic auth secret

        const secretNamespace = namespace;
        const middlewareNamespace = namespace;

        // Create a secret with basic auth users
        const existingSecrets = await k3s.core.listNamespacedSecret(secretNamespace);
        const existingSecret = existingSecrets.body.items.find((item) => item.metadata?.name === basicAuthSecretName);

        const usernameAndSha1PasswordStrings = usernamePassword.map(([username, password]) => `${username}:{SHA}${createHash('sha1').update(password).digest('base64')}`);

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
            middlewareNamespace,       // namespace
            'middlewares',          // plural name of the custom resource
            middlewareManifest      // object manifest
        );

        return `${namespace}-${basicAuthNameMiddlewareName}@kubernetescrd`;
    }
}

const ingressService = new IngressService();
export default ingressService;
