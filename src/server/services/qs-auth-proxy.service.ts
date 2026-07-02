import k3s from "../adapter/kubernetes-api.adapter";
import { Constants } from "../../shared/utils/constants";
import namespaceService from "./namespace.service";
import paramService from "./param.service";
import secretService from "./secret.service";

export const QS_AUTH_PROXY_SERVICE_NAME = 'qs-auth-proxy';
export const QS_AUTH_PROXY_SERVICE_PORT = 3000;

class QsAuthProxyService {
    private readonly agentSecretName = 'quickstack-agent-secrets';

    async ensureSecret() {
        const namespace = Constants.QS_AGENT_ROUTER_NAMESPACE;
        await namespaceService.createNamespaceIfNotExists(namespace);

        const secret = await paramService.getOrCreateAgentJwtSecret();
        await secretService.saveSecret(namespace, this.agentSecretName, {
            metadata: {
                name: this.agentSecretName,
                namespace,
            },
            type: 'Opaque',
            data: {
                AGENT_JWT_SECRET: Buffer.from(secret).toString('base64'),
            },
        });
    }

    async ensure() {
        const namespace = Constants.QS_AGENT_ROUTER_NAMESPACE;
        await namespaceService.createNamespaceIfNotExists(namespace);
        await this.ensureSecret();

        const serviceManifest = {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
                name: QS_AUTH_PROXY_SERVICE_NAME,
                namespace,
            },
            spec: {
                type: 'ClusterIP',
                selector: {
                    app: QS_AUTH_PROXY_SERVICE_NAME,
                },
                ports: [{
                    name: 'http',
                    protocol: 'TCP',
                    port: QS_AUTH_PROXY_SERVICE_PORT,
                    targetPort: QS_AUTH_PROXY_SERVICE_PORT,
                }],
            },
        };

        const deploymentManifest = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: QS_AUTH_PROXY_SERVICE_NAME,
                namespace,
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        app: QS_AUTH_PROXY_SERVICE_NAME,
                    },
                },
                template: {
                    metadata: {
                        labels: {
                            app: QS_AUTH_PROXY_SERVICE_NAME,
                        },
                    },
                    spec: {
                        containers: [{
                            name: 'auth-proxy',
                            image: Constants.QS_AUTH_PROXY_IMAGE,
                            imagePullPolicy: 'Always',
                            ports: [{
                                containerPort: QS_AUTH_PROXY_SERVICE_PORT,
                            }],
                            env: [
                                {
                                    name: 'AGENT_JWT_SECRET',
                                    valueFrom: {
                                        secretKeyRef: {
                                            name: this.agentSecretName,
                                            key: 'AGENT_JWT_SECRET',
                                        },
                                    },
                                },
                                {
                                    name: 'AUTH_DISABLED',
                                    value: 'false',
                                },
                            ],
                            resources: {
                                requests: {
                                    cpu: '50m',
                                    memory: '64Mi',
                                },
                                limits: {
                                    cpu: '200m',
                                    memory: '128Mi',
                                },
                            },
                        }],
                    },
                },
            },
        };

        await k3s.applyResource(serviceManifest, namespace);
        await k3s.applyResource(deploymentManifest, namespace);
    }
}

const qsAuthProxyService = new QsAuthProxyService();
export default qsAuthProxyService;
