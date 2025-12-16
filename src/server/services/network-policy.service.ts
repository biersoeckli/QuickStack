import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1NetworkPolicy, V1NetworkPolicyEgressRule, V1NetworkPolicyIngressRule } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Constants } from "../../shared/utils/constants";

class NetworkPolicyService {

    async reconcileNetworkPolicy(app: AppExtendedModel) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(app.id);
        const namespace = app.projectId;

        const policy: V1NetworkPolicy = {
            apiVersion: "networking.k8s.io/v1",
            kind: "NetworkPolicy",
            metadata: {
                name: policyName,
                namespace: namespace,
                labels: {
                    app: app.id
                },
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: app.id,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: app.projectId,
                }
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        app: app.id
                    }
                },
                policyTypes: ["Ingress", "Egress"],
                ingress: this.getIngressRules(app.ingressNetworkPolicy),
                egress: this.getEgressRules(app.egressNetworkPolicy)
            }
        };
        console.log(JSON.stringify(policy, null, 2));
        await this.applyNetworkPolicy(namespace, policyName, policy);
    }

    private getIngressRules(policyType: string): V1NetworkPolicyIngressRule[] {
        const rules: V1NetworkPolicyIngressRule[] = [];

        if (policyType === 'ALLOW_ALL') {
            // Allow from everywhere
            rules.push({
                from: [{
                    ipBlock: {
                        cidr: '0.0.0.0/0'
                    }
                }]
            });
        } else if (policyType === 'NAMESPACE_ONLY') {
            // Allow only from same namespace
            rules.push({
                from: [{
                    podSelector: {} // Selects all pods in the same namespace
                }]
            });
        } else if (policyType === 'DENY_ALL') {
            // No rules means deny all
        }

        return rules;
    }

    private getEgressRules(policyType: string): V1NetworkPolicyEgressRule[] {
        const rules: V1NetworkPolicyEgressRule[] = [];

        // Always allow DNS
        // We allow UDP/TCP 53 to everywhere because kube-dns IP might vary or be outside the namespace
        // and we want to be safe.
        rules.push({
            to: [
                {
                    namespaceSelector: {
                        matchLabels: {
                            "kubernetes.io/metadata.name": "kube-system"
                        }
                    },
                    podSelector: {
                        matchLabels: {
                            "k8s-app": "kube-dns"
                        }
                    }
                },
                {
                    ipBlock: {
                        cidr: '0.0.0.0/0'
                    }
                }
            ],
            ports: [
                { protocol: 'UDP', port: 53 as any },
                { protocol: 'TCP', port: 53 as any }
            ]
        });

        if (policyType === 'ALLOW_ALL') {
            // Allow Internet + Local Namespace, Block other namespaces (Private IPs)
            rules.push({
                to: [
                    {
                        ipBlock: {
                            cidr: '0.0.0.0/0',
                            except: [
                                '10.0.0.0/8',
                                '172.16.0.0/12',
                                '192.168.0.0/16'
                            ]
                        }
                    },
                    {
                        podSelector: {} // Allow all in same namespace
                    }
                ]
            });
        } else if (policyType === 'NAMESPACE_ONLY') {
            // Allow only to same namespace
            rules.push({
                to: [{
                    podSelector: {}
                }]
            });
        } else if (policyType === 'DENY_ALL') {
            // Only DNS allowed (already added)
        }

        return rules;
    }

    async deleteNetworkPolicy(appId: string, projectId: string) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(appId);
        const existingNetworkPolicy = await this.getExistingNetworkPolicy(projectId, policyName);
        if (!existingNetworkPolicy) {
            return;
        }
        await k3s.network.deleteNamespacedNetworkPolicy(policyName, projectId);
    }

    private async applyNetworkPolicy(namespace: string, policyName: string, body: V1NetworkPolicy) {
        const existing = await this.getExistingNetworkPolicy(namespace, policyName);
        if (existing) {
            await k3s.network.replaceNamespacedNetworkPolicy(policyName, namespace, body);
        } else {
            await k3s.network.createNamespacedNetworkPolicy(namespace, body);
        }
    }

    private async getExistingNetworkPolicy(namespace: string, policyName: string) {
        const allPolicies = await k3s.network.listNamespacedNetworkPolicy(namespace);
        return allPolicies.body.items.find(np => np.metadata?.name === policyName);
    }
}

const networkPolicyService = new NetworkPolicyService();
export default networkPolicyService;



