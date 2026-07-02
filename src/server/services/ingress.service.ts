import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1Ingress, V1Secret } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Constants } from "../../shared/utils/constants";
import ingressSetupService from "./setup-services/ingress-setup.service";
import { dlog } from "./deployment-logs.service";
import { createHash } from "crypto";
import { CryptoUtils } from "../utils/crypto.utils";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentDomain } from "@prisma/client";
import qsAuthProxyService, { QS_AUTH_PROXY_SERVICE_NAME, QS_AUTH_PROXY_SERVICE_PORT } from "./qs-auth-proxy.service";

class IngressService {
    private readonly clusterIssuerName = 'letsencrypt-production';

    private getAgentAccessResourceName(hostname: string): string {
        return `agent-access-${createHash('sha1').update(hostname).digest('hex').slice(0, 12)}`;
    }

    private tlsSecretNameFor(resourceId: string): string {
        return `secret-tls-${resourceId}`;
    }

    private buildIngressAnnotations(input: {
        ownerAnnotations: Record<string, string>;
        useSsl: boolean;
        redirectHttps?: boolean;
        middlewares?: string;
    }): Record<string, string> {
        const middlewareList = [
            input.middlewares,
            (input.useSsl && input.redirectHttps) ? 'kube-system-redirect-to-https@kubernetescrd' : undefined,
        ].filter((middleware) => !!middleware).join(',') || undefined;

        return {
            ...input.ownerAnnotations,
            ...(input.useSsl && { 'cert-manager.io/cluster-issuer': this.clusterIssuerName }),
            ...(middlewareList && { 'traefik.ingress.kubernetes.io/router.middlewares': middlewareList }),
            ...(!input.useSsl && { 'traefik.ingress.kubernetes.io/router.entrypoints': 'web' }),
        };
    }

    private buildIngressDefinition(input: {
        name: string;
        namespace: string;
        hostname: string;
        serviceName: string;
        servicePort: number;
        useSsl: boolean;
        redirectHttps?: boolean;
        ownerAnnotations: Record<string, string>;
        middlewares?: string;
        tlsSecretId: string;
    }): V1Ingress {
        return {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: input.name,
                namespace: input.namespace,
                annotations: this.buildIngressAnnotations({
                    ownerAnnotations: input.ownerAnnotations,
                    useSsl: input.useSsl,
                    redirectHttps: input.redirectHttps,
                    middlewares: input.middlewares,
                }),
            },
            spec: {
                ingressClassName: 'traefik',
                rules: [
                    {
                        host: input.hostname,
                        http: {
                            paths: [
                                {
                                    path: '/',
                                    pathType: 'Prefix',
                                    backend: {
                                        service: {
                                            name: input.serviceName,
                                            port: {
                                                number: input.servicePort,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
                ...(input.useSsl && {
                    tls: [
                        {
                            hosts: [input.hostname],
                            secretName: this.tlsSecretNameFor(input.tlsSecretId),
                        },
                    ],
                }),
            },
        };
    }

    private async getIngressByResourceName(namespace: string, ingressName: string) {
        const res = await k3s.network.listNamespacedIngress({ namespace: namespace });
        return res.items.find((item) => item.metadata?.name === ingressName);
    }

    private async applyIngress(namespace: string, ingressName: string, ingressDefinition: V1Ingress) {
        const existingIngress = await this.getIngressByResourceName(namespace, ingressName);
        if (existingIngress) {
            await k3s.network.replaceNamespacedIngress({ name: ingressName, namespace: namespace, body: ingressDefinition });
            return;
        }
        await k3s.network.createNamespacedIngress({ namespace: namespace, body: ingressDefinition });
    }

    async createOrUpdateAgentIngress(agent: AgentExtendedModel, domain: AgentDomain) {
        const hostname = domain.hostname;
        const namespace = Constants.QS_AGENT_ROUTER_NAMESPACE;
        const resourceName = this.getAgentAccessResourceName(hostname);

        await ingressSetupService.createTraefikRedirectMiddlewareIfNotExist();
        await qsAuthProxyService.ensure();

        const ingressDefinition = this.buildIngressDefinition({
            name: resourceName,
            namespace,
            hostname,
            serviceName: QS_AUTH_PROXY_SERVICE_NAME,
            servicePort: QS_AUTH_PROXY_SERVICE_PORT,
            useSsl: domain.useSsl,
            redirectHttps: domain.redirectHttps,
            ownerAnnotations: {
                [Constants.QS_ANNOTATION_AGENT_ID]: agent.id,
            },
            tlsSecretId: resourceName,
        });

        await this.applyIngress(namespace, resourceName, ingressDefinition);
    }

    async deleteAgentIngress(hostname: string) {
        const namespace = Constants.QS_AGENT_ROUTER_NAMESPACE;
        const resourceName = this.getAgentAccessResourceName(hostname);
        try {
            await k3s.network.deleteNamespacedIngress({ name: resourceName, namespace: namespace });
        } catch (error: any) {
            if (error?.response?.statusCode !== 404) {
                throw new ServiceException(`Failed to delete ingress/${resourceName}: ${error?.message || error}`);
            }
        }
    }

    /**
     * Lists all Kubernetes Ingresses belonging to a specific Agent.
     */
    async listAgentIngress(agentId: string): Promise<{ hostname: string; resourceName: string }[]> {
        const namespace = Constants.QS_AGENT_ROUTER_NAMESPACE;
        const result: { hostname: string; resourceName: string }[] = [];

        try {
            const ingresses = await k3s.network.listNamespacedIngress({ namespace: namespace });
            for (const ingress of ingresses.items) {
                const itemAgentId = ingress.metadata?.annotations?.[Constants.QS_ANNOTATION_AGENT_ID];
                if (itemAgentId !== agentId) continue;

                const resourceName = ingress.metadata?.name;
                const hostname = ingress.spec?.rules?.[0]?.host;
                if (resourceName && hostname) {
                    result.push({ hostname, resourceName });
                }
            }
        } catch (error: any) {
            if (error?.response?.statusCode !== 404) {
                throw new ServiceException(
                    `Failed to list agent Ingresses: ${error?.message || error}`,
                );
            }
        }

        return result;
    }

    async getAllIngressForApp(projectId: string, appId: string) {
        const res = await k3s.network.listNamespacedIngress({ namespace: projectId });
        return res.items.filter((item) => item.metadata?.annotations?.[Constants.QS_ANNOTATION_APP_ID] === appId);
    }

    async getIngressByName(projectId: string, domainId: string) {
        return this.getIngressByResourceName(projectId, KubeObjectNameUtils.getIngressName(domainId));
    }

    async deleteUnusedIngressesOfApp(app: AppExtendedModel) {
        const currentDomains = new Set(app.appDomains.map(domainObj => domainObj.hostname));
        const existingIngresses = await this.getAllIngressForApp(app.projectId, app.id);

        if (currentDomains.size === 0) {
            for (const ingress of existingIngresses) {
                await k3s.network.deleteNamespacedIngress({ name: ingress.metadata!.name!, namespace: app.projectId });
                console.log(`Deleted Ingress ${ingress.metadata!.name} for app ${app.id}`);
            }
        } else {
            for (const ingress of existingIngresses) {
                const ingressDomain = ingress.spec?.rules?.[0]?.host;

                if (ingressDomain && !currentDomains.has(ingressDomain)) {
                    await k3s.network.deleteNamespacedIngress({ name: ingress.metadata!.name!, namespace: app.projectId });
                    console.log(`Deleted Ingress ${ingress.metadata!.name} for domain ${ingressDomain}`);
                }
            }
        }
    }

    async deleteAllIngressForApp(projectId: string, appId: string) {
        const existingIngresses = await this.getAllIngressForApp(projectId, appId);
        for (const ingress of existingIngresses) {
            await k3s.network.deleteNamespacedIngress({ name: ingress.metadata!.name!, namespace: projectId });
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

        const ingressDefinition = this.buildIngressDefinition({
            name: ingressName,
            namespace: app.projectId,
            hostname,
            serviceName: KubeObjectNameUtils.toServiceName(app.id),
            servicePort: domain.port,
            useSsl: domain.useSsl,
            redirectHttps: domain.redirectHttps,
            middlewares: basicAuthMiddlewareName,
            ownerAnnotations: {
                [Constants.QS_ANNOTATION_APP_ID]: app.id,
                [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
            },
            tlsSecretId: domain.id,
        });

        await dlog(deploymentId, `Configuring Ingress with Domain ${domain.useSsl ? 'https' : 'http'}://${hostname} --> ${app.id}:${domain.port}`);
        await this.applyIngress(app.projectId, ingressName, ingressDefinition);
        if (existingIngress) {
            console.log(`Ingress ${ingressName} for domain ${hostname} successfully updated.`);
        } else {
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
        const existingMiddlewares = await k3s.customObjects.listNamespacedCustomObject({ group: 'traefik.io', version: 'v1alpha1', namespace: namespace, plural: 'middlewares' });
        const existingBasicAuthMiddleware = (existingMiddlewares as any).items.find((item: any) => item.metadata?.name === middlewareName);
        if (existingBasicAuthMiddleware) {
            await k3s.customObjects.deleteNamespacedCustomObject({ group: 'traefik.io', version: 'v1alpha1', namespace: namespace, plural: 'middlewares', name: middlewareName });
        }

        // delete traefik basic auth secret
        const secretName = `bas-${basicAuthId}`;
        const existingSecrets = await k3s.core.listNamespacedSecret({ namespace: namespace });
        const existingSecret = existingSecrets.items.find((item) => item.metadata?.name === secretName);
        if (existingSecret) {
            await k3s.core.deleteNamespacedSecret({ name: secretName, namespace: namespace });
        }

        // delete plaintext credentials secret
        const plaintextSecretName = `bas-plain-${basicAuthId}`;
        const existingPlaintextSecret = existingSecrets.items.find((item) => item.metadata?.name === plaintextSecretName);
        if (existingPlaintextSecret) {
            await k3s.core.deleteNamespacedSecret({ name: plaintextSecretName, namespace: namespace });
        }
    }

    /**
     * Reads plaintext credentials from a separate bas-plain-{id} secret created alongside the basic auth middleware.
     * @returns { username, password } or undefined if not present
     */
    async getPlaintextCredentialsFromSecret(namespace: string, basicAuthId: string): Promise<{ username: string; password: string } | undefined> {
        const plaintextSecretName = `bas-plain-${basicAuthId}`;
        const existingSecrets = await k3s.core.listNamespacedSecret({ namespace: namespace });
        const secret = existingSecrets.items.find((item) => item.metadata?.name === plaintextSecretName);
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
        const existingSecrets = await k3s.core.listNamespacedSecret({ namespace: secretNamespace });
        const existingSecret = existingSecrets.items.find((item) => item.metadata?.name === basicAuthSecretName);

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
            await k3s.core.deleteNamespacedSecret({ name: basicAuthSecretName, namespace: secretNamespace });
        }
        await k3s.core.createNamespacedSecret({ namespace: secretNamespace, body: secretManifest });

        // Store plaintext credentials in a separate secret so they can be displayed to the user
        if (storeCredentialsSeparately && usernamePassword.length > 0) {
            const plaintextSecretName = `bas-plain-${basicAuthId}`;
            const existingPlaintextSecret = existingSecrets.items.find((item) => item.metadata?.name === plaintextSecretName);
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
                await k3s.core.deleteNamespacedSecret({ name: plaintextSecretName, namespace: secretNamespace });
            }
            await k3s.core.createNamespacedSecret({ namespace: secretNamespace, body: plaintextSecretManifest });
        }

        // Create a middleware with basic auth
        const existingBasicAuthMiddlewares = await k3s.customObjects.listNamespacedCustomObject({ group: 'traefik.io', version: 'v1alpha1', namespace: middlewareNamespace, plural: 'middlewares' });
        const existingBasicAuthMiddleware = (existingBasicAuthMiddlewares as any).items.find((item: any) => item.metadata?.name === basicAuthNameMiddlewareName);

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
            await k3s.customObjects.deleteNamespacedCustomObject({ group: 'traefik.io', version: 'v1alpha1', namespace: middlewareNamespace, plural: 'middlewares', name: basicAuthNameMiddlewareName });
        }
        await k3s.customObjects.createNamespacedCustomObject({ group: 'traefik.io', version: 'v1alpha1', namespace: middlewareNamespace, plural: 'middlewares', body: middlewareManifest });

        return `${namespace}-${basicAuthNameMiddlewareName}@kubernetescrd`;
    }
}

const ingressService = new IngressService();
export default ingressService;
