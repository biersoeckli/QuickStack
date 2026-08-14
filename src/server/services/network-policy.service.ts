import { AppExtendedModel, AppNetworkPolicyRuleWithTargetModel } from "@/shared/model/app-extended.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { V1NetworkPolicy, V1NetworkPolicyEgressRule, V1NetworkPolicyIngressRule, V1NetworkPolicyPeer } from "@kubernetes/client-node";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Constants } from "../../shared/utils/constants";
import { appNetworkPolicy, AppNetworkPolicyType } from "@/shared/model/network-policy.model";
import type { SandboxTemplateNetworkPolicy } from "../adapter/api-clients/types/agents.models";
import type { AgentNetworkPolicyRuleWithTargetAppModel } from "@/shared/model/agent-extended.model";
import { QS_AUTH_PROXY_SERVICE_NAME } from "./qs-auth-proxy.service";

export type AgentSandboxTemplateNetworkPolicyConfig = {
    allowInternetAccess: boolean;
    rules: AgentNetworkPolicyRuleWithTargetAppModel[];
} | null;

type TargetNetworkPolicyRule = {
    targetAppId?: string | null;
    targetAgentId?: string | null;
    targetApp?: {
        projectId: string;
    } | null;
    targetAgent?: {
        projectId: string;
    } | null;
    port: number;
    protocol?: string;
};

class NetworkPolicyService {

    async reconcileNetworkPolicy(app: AppExtendedModel) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(app.id);
        const namespace = app.projectId;

        // If network policies are disabled, delete existing policy if any and return
        if (!app.useNetworkPolicy) {
            await this.deleteNetworkPolicy(app.id, app.projectId);
            return;
        }

        const isExtended = app.networkPolicyMode === 'EXTENDED';
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
                ingress: isExtended
                    ? this.getExtendedIngressRules(app.appNetworkPolicy?.rules ?? [], (app.appDomains?.length ?? 0) > 0, app.appNodePorts)
                    : this.getIngressRules(ingressPolicy, app.appNodePorts, (app.appDomains?.length ?? 0) > 0),
                egress: isExtended
                    ? this.getExtendedEgressRules(app.appNetworkPolicy?.rules ?? [], app.appNetworkPolicy?.allowInternetAccess !== false)
                    : this.getEgressRules(egressPolicy)
            }
        };
        await this.applyNetworkPolicy(namespace, policyName, policy);
    }

    private getExtendedIngressRules(rules: AppNetworkPolicyRuleWithTargetModel[], hasDomains: boolean, nodePorts: { port: number; protocol?: string }[]): V1NetworkPolicyIngressRule[] {
        const result: V1NetworkPolicyIngressRule[] = [];
        const backupAndTools: V1NetworkPolicyPeer[] = [
            { podSelector: { matchLabels: { [Constants.QS_ANNOTATION_CONTAINER_TYPE]: Constants.QS_ANNOTATION_CONTAINER_TYPE_DB_BACKUP_JOB } } },
            { podSelector: { matchLabels: { [Constants.QS_ANNOTATION_CONTAINER_TYPE]: Constants.QS_ANNOTATION_CONTAINER_TYPE_DB_TOOL } } },
        ];
        result.push({ _from: backupAndTools });
        if (hasDomains) result.push({ _from: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } }, podSelector: { matchLabels: { 'app.kubernetes.io/name': 'traefik' } } }] });
        for (const rule of rules.filter(rule => rule.type === 'INGRESS')) result.push({
            _from: [this.getTargetPeer(rule)],
            ports: [{ protocol: rule.protocol, port: rule.port }],
        });
        return [...result, ...this.getNodePortIngressRules(nodePorts)];
    }

    private getExtendedEgressRules(rules: AppNetworkPolicyRuleWithTargetModel[], allowInternetAccess: boolean): V1NetworkPolicyEgressRule[] {
        const result: V1NetworkPolicyEgressRule[] = [this.getDnsEgressRule()];
        if (allowInternetAccess) result.push(this.getInternetEgressRule());
        for (const rule of rules.filter(rule => rule.type === 'EGRESS')) result.push(this.getTargetEgressRule(rule));
        return result;
    }

    private getTargetPeer(rule: TargetNetworkPolicyRule): V1NetworkPolicyPeer {
        const target = rule.targetAgent ?? rule.targetApp;
        const targetId = rule.targetAgentId ?? rule.targetAppId;
        if (!target || !targetId) throw new Error('Network policy rule has no target.');
        return {
            namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': target.projectId } },
            podSelector: { matchLabels: rule.targetAgentId ? { [Constants.QS_ANNOTATION_AGENT_ID]: targetId } : { app: targetId } },
        };
    }

    private getTargetEgressRule(rule: TargetNetworkPolicyRule): V1NetworkPolicyEgressRule {
        return {
            to: [this.getTargetPeer(rule)],
            ports: [{ protocol: rule.protocol || 'TCP', port: rule.port }],
        };
    }

    private getInternetEgressRule(): V1NetworkPolicyEgressRule {
        return {
            to: [{
                ipBlock: {
                    cidr: '0.0.0.0/0',
                    except: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16'],
                },
            }],
        };
    }

    private getNodePortIngressRules(nodePorts: { port: number; protocol?: string }[]): V1NetworkPolicyIngressRule[] {
        if (!nodePorts.length) return [];
        return [{ _from: [{ ipBlock: { cidr: '0.0.0.0/0' } }], ports: nodePorts.map(nodePort => ({ protocol: (nodePort.protocol || 'TCP'), port: nodePort.port })) }];
    }

    private getDnsEgressRule(): V1NetworkPolicyEgressRule {
        return { to: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } }, podSelector: { matchLabels: { 'k8s-app': 'kube-dns' } } }, { namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'kube-system' } }, podSelector: { matchLabels: { 'k8s-app': 'coredns' } } }], ports: [{ protocol: 'UDP', port: 53 }, { protocol: 'TCP', port: 53 }] };
    }

    buildAgentSandboxTemplateNetworkPolicy(
        agentNetworkPolicy?: AgentSandboxTemplateNetworkPolicyConfig,
    ): SandboxTemplateNetworkPolicy | undefined {
        if (!agentNetworkPolicy) {
            return undefined;
        }

        const egress: NonNullable<SandboxTemplateNetworkPolicy>['egress'] = [this.getDnsEgressRule()];

        if (agentNetworkPolicy.allowInternetAccess) {
            egress.push(this.getInternetEgressRule());
        }

        const seen = new Set<string>();
        for (const rule of agentNetworkPolicy.rules) {
            if (rule.type && rule.type !== 'EGRESS') {
                continue;
            }
            const targetProjectId = rule.targetApp.projectId;
            const protocol = rule.protocol || 'TCP';
            const dedupeKey = `${rule.targetAppId}:${targetProjectId}:${rule.port}:${protocol}`;
            if (seen.has(dedupeKey)) {
                continue;
            }
            seen.add(dedupeKey);

            egress.push(this.getTargetEgressRule({ ...rule, protocol }));
        }

        return {
            ingress: [{
                from: [{
                    podSelector: {
                        matchLabels: {
                            app: QS_AUTH_PROXY_SERVICE_NAME,
                        },
                    },
                }],
            }],
            egress,
        };
    }

    private normalizePolicy(raw: string): AppNetworkPolicyType {
        const parsed = appNetworkPolicy.safeParse(raw);
        return parsed.success ? parsed.data : 'ALLOW_ALL';
    }

    private getIngressRules(policyType: AppNetworkPolicyType, nodePorts: { port: number; protocol?: string }[] = [], hasDomains = false): V1NetworkPolicyIngressRule[] {
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

        const dbToolPod: V1NetworkPolicyPeer[] = [{
            podSelector: {
                matchLabels: {
                    [Constants.QS_ANNOTATION_CONTAINER_TYPE]: Constants.QS_ANNOTATION_CONTAINER_TYPE_DB_TOOL
                }
            }
        }];

        if (policyType === 'ALLOW_ALL') {
            // Allow from same namespace and from Traefik (internet traffic comes through Traefik)
            rules.push({
                _from: [
                    ...(hasDomains ? traefikFrom : []),
                    {
                        podSelector: {} // Selects all pods in the same namespace
                    }
                ]
            });
        } else if (policyType === 'INTERNET_ONLY') {
            // Allow from Traefik (internet traffic comes through Traefik) and from DB-backup jobs.
            // Block other internal pod traffic.
            rules.push({
                _from: [
                    ...(hasDomains ? traefikFrom : []),
                    ...backupPodFrom,
                    ...dbToolPod
                ]
            });
        } else if (policyType === 'NAMESPACE_ONLY') {
            // Allow only from same namespace
            rules.push({
                _from: [{
                    podSelector: {} // Selects all pods in the same namespace
                }]
            });
        } else if (policyType === 'DENY_ALL') {
            // No rules means deny all --> except the separate container for database backups
            rules.push({
                _from: [
                    ...backupPodFrom,
                    ...dbToolPod
                ]
            });
        }

        if (nodePorts.length > 0) {
            const exposedPorts = nodePorts
                .filter((nodePort, index, self) =>
                    index === self.findIndex(item =>
                        item.port === nodePort.port && (item.protocol || 'TCP') === (nodePort.protocol || 'TCP')))
                .map(nodePort => ({
                    protocol: (nodePort.protocol || 'TCP'),
                    port: nodePort.port
                }));

            rules.push({
                _from: [{
                    ipBlock: {
                        cidr: '0.0.0.0/0'
                    }
                }],
                ports: exposedPorts
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
                { protocol: 'UDP', port: 53 },
                { protocol: 'TCP', port: 53 }
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
        await k3s.network.deleteNamespacedNetworkPolicy({ name: policyName, namespace: projectId });
    }

    private async applyNetworkPolicy(namespace: string, policyName: string, body: V1NetworkPolicy) {
        const existing = await this.getExistingNetworkPolicy(namespace, policyName);
        if (existing) {
            await k3s.network.replaceNamespacedNetworkPolicy({ name: policyName, namespace: namespace, body: body });
        } else {
            await k3s.network.createNamespacedNetworkPolicy({ namespace: namespace, body: body });
        }
    }

    private async getExistingNetworkPolicy(namespace: string, policyName: string) {
        const allPolicies = await k3s.network.listNamespacedNetworkPolicy({ namespace: namespace });
        return allPolicies.items.find(np => np.metadata?.name === policyName);
    }

    async reconcileDbToolNetworkPolicy(dbToolAppName: string, dbAppId: string, projectId: string) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(dbToolAppName);
        const namespace = projectId;

        const policy: V1NetworkPolicy = {
            apiVersion: "networking.k8s.io/v1",
            kind: "NetworkPolicy",
            metadata: {
                name: policyName,
                namespace: namespace,
                labels: {
                    app: dbToolAppName,
                    'db-tool': 'true'
                },
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: dbAppId,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: projectId,
                }
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        app: dbToolAppName
                    }
                },
                policyTypes: ["Ingress", "Egress"],
                ingress: [
                    {
                        // Allow from Traefik (internet traffic)
                        _from: [
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
                            }
                        ]
                    }
                ],
                egress: [
                    {
                        // Allow DNS
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
                            { protocol: 'UDP', port: 53 },
                            { protocol: 'TCP', port: 53 }
                        ]
                    },
                    {
                        // Allow only to database pod in same namespace
                        to: [
                            {
                                podSelector: {
                                    matchLabels: {
                                        app: dbAppId
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        };
        console.log('Creating DB Tool Network Policy:', JSON.stringify(policy, null, 2));
        await this.applyNetworkPolicy(namespace, policyName, policy);
    }

    async deleteDbToolNetworkPolicy(dbToolAppName: string, projectId: string) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(dbToolAppName);
        const existingNetworkPolicy = await this.getExistingNetworkPolicy(projectId, policyName);
        if (!existingNetworkPolicy) {
            return;
        }
        await k3s.network.deleteNamespacedNetworkPolicy({ name: policyName, namespace: projectId });
    }

    async reconcileFileBrowserNetworkPolicy(fileBrowserAppName: string, projectId: string) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(fileBrowserAppName);
        const namespace = projectId;

        const policy: V1NetworkPolicy = {
            apiVersion: "networking.k8s.io/v1",
            kind: "NetworkPolicy",
            metadata: {
                name: policyName,
                namespace: namespace,
                labels: {
                    app: fileBrowserAppName,
                    'file-browser': 'true'
                },
                annotations: {
                    [Constants.QS_ANNOTATION_PROJECT_ID]: projectId,
                }
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        app: fileBrowserAppName
                    }
                },
                policyTypes: ["Ingress", "Egress"],
                ingress: [
                    {
                        // Allow from Traefik (internet traffic)
                        _from: [
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
                            }
                        ]
                    }
                ],
                egress: [] // Deny all outgoing traffic
            }
        };
        console.log('Creating FileBrowser Network Policy:', JSON.stringify(policy, null, 2));
        await this.applyNetworkPolicy(namespace, policyName, policy);
    }

    async deleteFileBrowserNetworkPolicy(fileBrowserAppName: string, projectId: string) {
        const policyName = KubeObjectNameUtils.toNetworkPolicyName(fileBrowserAppName);
        const existingNetworkPolicy = await this.getExistingNetworkPolicy(projectId, policyName);
        if (!existingNetworkPolicy) {
            return;
        }
        await k3s.network.deleteNamespacedNetworkPolicy({ name: policyName, namespace: projectId });
    }

    async deleteAllNetworkPolicies() {
        const namespaces = await k3s.core.listNamespace();
        let deletedCount = 0;

        for (const ns of namespaces.items) {
            const namespace = ns.metadata?.name;
            if (!namespace) continue;

            try {
                const policies = await k3s.network.listNamespacedNetworkPolicy({ namespace: namespace });
                for (const policy of policies.items) {
                    const policyName = policy.metadata?.name;
                    if (policyName) {
                        await k3s.network.deleteNamespacedNetworkPolicy({ name: policyName, namespace: namespace });
                        deletedCount++;
                    }
                }
            } catch (error) {
                console.error(`Error deleting network policies in namespace ${namespace}:`, error);
            }
        }

        return deletedCount;
    }
}

const networkPolicyService = new NetworkPolicyService();
export default networkPolicyService;
