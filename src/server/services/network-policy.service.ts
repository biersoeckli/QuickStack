import { AppExtendedModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1NetworkPolicy, V1NetworkPolicyEgressRule, V1NetworkPolicyIngressRule, V1NetworkPolicyPeer } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Constants } from "../../shared/utils/constants";
import { appNetworkPolicy, AppNetworkPolicyType } from "@/shared/model/network-policy.model";

class NetworkPolicyService {

    async reconcileNetworkPolicy(app: AppExtendedModel) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(app.id);
        const namespace = app.projectId;

        // If network policies are disabled, delete existing policy if any and return
        if (!app.useNetworkPolicy) {
            await this.deleteNetworkPolicy(app.id, app.projectId);
            return;
        }

        const ingressPolicy = this.normalizePolicy(app.ingressNetworkPolicy);
        const egressPolicy = this.normalizePolicy(app.egressNetworkPolicy);

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
                ingress: this.getIngressRules(ingressPolicy),
                egress: this.getEgressRules(egressPolicy)
            }
        };
        console.log(JSON.stringify(policy, null, 2));
        await this.applyNetworkPolicy(namespace, policyName, policy);
    }

    private normalizePolicy(raw: string): AppNetworkPolicyType {
        const parsed = appNetworkPolicy.safeParse(raw);
        return parsed.success ? parsed.data : 'ALLOW_ALL';
    }

    private getIngressRules(policyType: AppNetworkPolicyType): V1NetworkPolicyIngressRule[] {
        const rules: V1NetworkPolicyIngressRule[] = [];

        const traefikFrom: V1NetworkPolicyPeer[] = [
            {
                namespaceSelector: {
                    matchLabels: {
                        'kubernetes.io/metadata.name': 'kube-system'
                    }
                },
                podSelector: {
                    matchLabels: {
                        'app.kubernetes.io/name': 'traefik'
                    }
                }
            },
            /* // Fallback label used in some clusters/charts
             {
                 namespaceSelector: {
                     matchLabels: {
                         'kubernetes.io/metadata.name': 'kube-system'
                     }
                 },
                 podSelector: {
                     matchLabels: {
                         app: 'traefik'
                     }
                 }
             }*/
        ];

        const backupPodFrom: V1NetworkPolicyPeer[] = [{
            podSelector: {
                matchLabels: {
                    [Constants.QS_ANNOTATION_CONTAINER_TYPE]: Constants.QS_ANNOTATION_CONTAINER_TYPE_DB_BACKUP_JOB
                }
            }
        }];

        if (policyType === 'ALLOW_ALL') {
            // Allow from same namespace and from Traefik (internet traffic comes through Traefik)
            rules.push({
                from: [
                    ...traefikFrom,
                    {
                        podSelector: {} // Selects all pods in the same namespace
                    }
                ]
            });
        } else if (policyType === 'INTERNET_ONLY') {
            // Allow from Traefik (internet traffic comes through Traefik) and from DB-backup jobs.
            // Block other internal pod traffic.
            rules.push({
                from: [
                    ...traefikFrom,
                    ...backupPodFrom
                ]
            });
        } else if (policyType === 'NAMESPACE_ONLY') {
            // Allow only from same namespace
            rules.push({
                from: [{
                    podSelector: {} // Selects all pods in the same namespace
                }]
            });
        } else if (policyType === 'DENY_ALL') {
            // No rules means deny all --> except the separate container for database backups
            rules.push({
                from: [
                    ...backupPodFrom
                ]
            });
        }

        return rules;
    }

    private getEgressRules(policyType: AppNetworkPolicyType): V1NetworkPolicyEgressRule[] {
        const rules: V1NetworkPolicyEgressRule[] = [];

        // allow DNS (kube-dns/coredns) on UDP/TCP 53
        const dnsRuleAllow: V1NetworkPolicyEgressRule = {
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
                    namespaceSelector: {
                        matchLabels: {
                            "kubernetes.io/metadata.name": "kube-system"
                        }
                    },
                    podSelector: {
                        matchLabels: {
                            "k8s-app": "coredns"
                        }
                    }
                }
            ],
            ports: [
                { protocol: 'UDP', port: 53 as any },
                { protocol: 'TCP', port: 53 as any }
            ]
        };

        if (policyType === 'ALLOW_ALL') {
            // Allow Internet + Local Namespace, Block other namespaces (Private IPs)
            rules.push(dnsRuleAllow);
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
        } else if (policyType === 'INTERNET_ONLY') {
            // Allow only to internet, block internal cluster traffic
            rules.push(dnsRuleAllow);
            rules.push({
                to: [{
                    ipBlock: {
                        cidr: '0.0.0.0/0',
                        except: [
                            '10.0.0.0/8',
                            '172.16.0.0/12',
                            '192.168.0.0/16'
                        ]
                    }
                }]
            });
        } else if (policyType === 'NAMESPACE_ONLY') {
            // Allow only to same namespace
            rules.push(dnsRuleAllow);
            rules.push({
                to: [{
                    podSelector: {}
                }]
            });
        } else if (policyType === 'DENY_ALL') {
            // Allow completely nothing
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



