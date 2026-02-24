import { randomBytes } from 'crypto';
import k3s from '../adapter/kubernetes-api.adapter';
import { KubeObjectNameUtils } from '../utils/kube-object-name.utils';
import ingressService from './ingress.service';
import hostnameDnsProviderService from './hostname-dns-provider.service';
import { V1Ingress } from '@kubernetes/client-node';
import { AppTemplateUtils } from '../utils/app-template.utils';
import { CryptoUtils } from '../utils/crypto.utils';

class LonghornUiService {

    private readonly NAMESPACE = 'longhorn-system';
    private readonly INGRESS_ID = 'longhorn-ui';
    private readonly LONGHORN_FRONTEND_SERVICE = 'longhorn-frontend';
    private readonly LONGHORN_FRONTEND_PORT = 80;
    private readonly USERNAME = 'quickstack';

    async isIngressActive(): Promise<boolean> {
        const existing = await ingressService.getIngressByName(this.NAMESPACE, this.INGRESS_ID);
        return !!existing;
    }

    async enable(): Promise<{ url: string; username: string; password: string }> {
        const password = CryptoUtils.generateStrongPasswort(35);
        const hostname = await hostnameDnsProviderService.getHexDomainForApp(this.INGRESS_ID);

        const basicAuthMiddlewareName = await ingressService.configureBasicAuthMiddleware(
            this.NAMESPACE,
            this.INGRESS_ID,
            [[this.USERNAME, password]],
            true  // store plaintext credentials in the secret
        );

        const ingressName = KubeObjectNameUtils.getIngressName(this.INGRESS_ID);
        const ingressDefinition: V1Ingress = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'Ingress',
            metadata: {
                name: ingressName,
                namespace: this.NAMESPACE,
                annotations: {
                    'cert-manager.io/cluster-issuer': 'letsencrypt-production',
                    'traefik.ingress.kubernetes.io/router.middlewares': basicAuthMiddlewareName,
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
                                            name: this.LONGHORN_FRONTEND_SERVICE,
                                            port: {
                                                number: this.LONGHORN_FRONTEND_PORT,
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                ],
                tls: [
                    {
                        hosts: [hostname],
                        secretName: `secret-tls-${this.INGRESS_ID}`,
                    },
                ],
            },
        };

        const existingIngress = await ingressService.getIngressByName(this.NAMESPACE, this.INGRESS_ID);
        if (existingIngress) {
            await k3s.network.replaceNamespacedIngress(ingressName, this.NAMESPACE, ingressDefinition);
        } else {
            await k3s.network.createNamespacedIngress(this.NAMESPACE, ingressDefinition);
        }

        return { url: `https://${hostname}`, username: this.USERNAME, password };
    }

    async getCredentials(): Promise<{ url: string; username: string; password: string } | undefined> {
        const creds = await ingressService.getPlaintextCredentialsFromSecret(this.NAMESPACE, this.INGRESS_ID);
        if (!creds) return undefined;
        const hostname = await hostnameDnsProviderService.getHexDomainForApp(this.INGRESS_ID);
        return { url: `https://${hostname}`, ...creds };
    }

    async disable(): Promise<void> {
        const ingressName = KubeObjectNameUtils.getIngressName(this.INGRESS_ID);
        const existingIngress = await ingressService.getIngressByName(this.NAMESPACE, this.INGRESS_ID);
        if (existingIngress) {
            await k3s.network.deleteNamespacedIngress(ingressName, this.NAMESPACE);
        }
        await ingressService.deleteUnusedBasicAuthMiddlewares(this.NAMESPACE, this.INGRESS_ID);
    }
}

const longhornUiService = new LonghornUiService();
export default longhornUiService;
