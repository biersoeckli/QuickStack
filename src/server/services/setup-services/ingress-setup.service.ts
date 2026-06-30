import k3s from "../../adapter/kubernetes-api.adapter";

const traefikNamespace = 'kube-system';

class IngressSetupService {

    async checkIfTraefikRedirectMiddlewareExists() {
        const res = await k3s.customObjects.listNamespacedCustomObject({ group: 'traefik.io', version: 'v1alpha1', namespace: traefikNamespace, plural: 'middlewares' });
        return (res as any) && (res as any)?.items && (res as any)?.items?.length > 0;
    }

    async createTraefikRedirectMiddlewareIfNotExist() {
        if (await this.checkIfTraefikRedirectMiddlewareExists()) {
            return;
        }

        const middlewareManifest = {
            apiVersion: 'traefik.io/v1alpha1',
            kind: 'Middleware',
            metadata: {
                name: 'redirect-to-https',
                namespace: traefikNamespace,
            },
            spec: {
                redirectScheme: {
                    scheme: 'https',
                    permanent: true,
                }
            },
        };

        await k3s.customObjects.createNamespacedCustomObject({ group: 'traefik.io', version: 'v1alpha1', namespace: traefikNamespace, plural: 'middlewares', body: middlewareManifest });
    }
}

const ingressSetupService = new IngressSetupService();
export default ingressSetupService;
