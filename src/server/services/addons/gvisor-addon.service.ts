import k3s from '@/server/adapter/kubernetes-api.adapter';
import { AddonMetadata, AddonOperationResult, AddonRelease, AddonResourceOperation, AddonStatus } from '@/shared/model/cluster-addon.model';
import { ServiceException } from '@/shared/model/service.exception.model';
import { AddonKubernetesUtils } from '@/server/utils/addon-kubernetes.utils';
import { BaseClusterAddon } from './base-cluster-addon.service';
import { ClusterAddon } from './cluster-addon.interface';

class GvisorAddonService extends BaseClusterAddon implements ClusterAddon {
    private static readonly NAMESPACE = 'quickstack-gvisor-system';
    private static readonly CONFIG_NAME = 'quickstack-gvisor-config';
    private static readonly DAEMON_SET_NAME = 'quickstack-gvisor-installer';
    private static readonly RELEASES: readonly AddonRelease[] = [
        {
            version: '20260921',
            manifestUrl: 'https://storage.googleapis.com/gvisor/releases/20260921'
        },
    ];

    readonly metadata: AddonMetadata = {
        id: 'gvisor', displayName: 'gVisor',
        description: 'Provides the optional gVisor runtime on supported Ubuntu and Debian cluster nodes.',
        documentationUrl: 'https://gvisor.dev/docs/user_guide/install/',
        managedNamespaces: [GvisorAddonService.NAMESPACE], canUninstall: false,
        updateWarning: {
            title: 'This changes every schedulable node:',
            items: [
                'gVisor cannot be removed through QuickStack once installed.',
                'Each node is cordoned and K3s is restarted serially. Workloads are not drained.',
                'A single-server control plane is briefly unavailable while its K3s service restarts.',
            ]
        },
    };

    constructor() { super('gvisor'); }

    async getStatus(): Promise<AddonStatus> {
        const active = this.getActiveOperation();
        if (active) {
            return { status: active };
        }
        try {
            const config = await k3s.core.readNamespacedConfigMap({
                name: GvisorAddonService.CONFIG_NAME,
                namespace: GvisorAddonService.NAMESPACE
            });
            const desired = config.data?.version;
            if (!desired) {
                return {
                    status: 'failed',
                    message: 'The gVisor desired-version ConfigMap is invalid.'
                };
            }
            const daemonSet = await k3s.apps.readNamespacedDaemonSet({
                name: GvisorAddonService.DAEMON_SET_NAME,
                namespace: GvisorAddonService.NAMESPACE
            });
            const nodes = (await k3s.core.listNode()).items.filter((node) => !node.spec?.unschedulable);

            const missing = nodes.find((node) => node.metadata?.labels?.['quickstack.dev/gvisor'] !== 'true' ||
                node.metadata?.labels?.['quickstack.dev/gvisor-version'] !== desired);
            if (missing) {
                return {
                    status: 'updating',
                    installedVersion: desired,
                    message: `Waiting for gVisor on node ${missing.metadata?.name ?? '<unknown>'}.`
                };
            }
            if ((daemonSet.status?.numberUnavailable ?? 0) > 0) {
                return {
                    status: 'updating',
                    installedVersion: desired,
                    message: 'Waiting for the gVisor installer DaemonSet.'
                };
            }
            return {
                status: 'ready',
                installedVersion: desired
            };
        } catch (error) {
            if (AddonKubernetesUtils.isNotFound(error)) {
                return { status: 'notInstalled' };
            }
            return {
                status: 'failed',
                message: AddonKubernetesUtils.errorMessage(error)
            };
        }
    }

    async install(): Promise<AddonOperationResult> {
        return this.runExclusive('installing', async () => {
            const status = await this.getStatus();
            if (status.status !== 'notInstalled') {
                throw new ServiceException('gVisor is already installed or installation is in progress.');
            }
            return this.reconcile(GvisorAddonService.RELEASES[0]);
        });
    }

    async getAvailableUpdate(): Promise<AddonRelease | undefined> {
        const status = await this.getStatus();
        if (!status.installedVersion) {
            return undefined;
        }
        const index = GvisorAddonService.RELEASES.findIndex((release) => release.version === status.installedVersion);
        if (index === -1) {
            throw new ServiceException(`Installed gVisor version ${status.installedVersion} is not managed by QuickStack.`);
        }
        return GvisorAddonService.RELEASES[index - 1];
    }

    async update(): Promise<AddonOperationResult> {
        return this.runExclusive('updating', async () => {
            const update = await this.getAvailableUpdate();
            if (!update) {
                throw new ServiceException('No newer gVisor version is available.');
            }
            return this.reconcile(update);
        });
    }

    async uninstall(): Promise<AddonOperationResult> {
        throw new ServiceException('gVisor cannot be removed through QuickStack.');
    }

    private async reconcile(release: AddonRelease): Promise<AddonOperationResult> {
        const resources: AddonResourceOperation[] = [];
        for (const spec of this.resources(release)) {
            resources.push(await this.applyResource(spec));
        }
        return AddonKubernetesUtils.operationResult(release, resources);
    }

    private resources(release: AddonRelease): any[] {
        const namespace = GvisorAddonService.NAMESPACE;
        return [
            // Namespace
            { apiVersion: 'v1', kind: 'Namespace', metadata: { name: namespace } },
            // Service Account
            { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { name: 'quickstack-gvisor-installer', namespace } },
            // Cluster Role (for Service Account)
            {
                apiVersion: 'rbac.authorization.k8s.io/v1',
                kind: 'ClusterRole',
                metadata: {
                    name: 'quickstack-gvisor-installer'
                },
                rules: [
                    { apiGroups: [''], resources: ['nodes'], verbs: ['get', 'list', 'patch'] },
                    { apiGroups: ['coordination.k8s.io'], resources: ['leases'], verbs: ['get', 'create', 'update', 'patch'] },
                ],
            },
            {
                apiVersion: 'rbac.authorization.k8s.io/v1',
                kind: 'ClusterRoleBinding',
                metadata: {
                    name: 'quickstack-gvisor-installer'
                },
                roleRef: {
                    apiGroup: 'rbac.authorization.k8s.io',
                    kind: 'ClusterRole',
                    name: 'quickstack-gvisor-installer'
                },
                subjects: [{
                    kind: 'ServiceAccount',
                    name: 'quickstack-gvisor-installer',
                    namespace
                }],
            },
            // Config Map for Setup Script and gVisor Version
            {
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: {
                    name: GvisorAddonService.CONFIG_NAME,
                    namespace
                },
                data: {
                    version: release.version,
                    'reconcile.sh': this.reconcileScript()
                },
            },
            // Runtime Class for gVisor
            {
                apiVersion: 'node.k8s.io/v1',
                kind: 'RuntimeClass',
                metadata: {
                    name: 'gvisor'
                },
                handler: 'gvisor'
            },
            // DeamonSet for actual installation of gVisor on Nodes
            {
                apiVersion: 'apps/v1',
                kind: 'DaemonSet',
                metadata: {
                    name: GvisorAddonService.DAEMON_SET_NAME,
                    namespace
                },
                spec: {
                    selector: {
                        matchLabels: {
                            app: GvisorAddonService.DAEMON_SET_NAME
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: GvisorAddonService.DAEMON_SET_NAME,
                                'quickstack.dev/gvisor-release': release.version
                            }
                        },
                        spec: {
                            serviceAccountName: 'quickstack-gvisor-installer',
                            hostPID: true,
                            containers: [{
                                name: 'installer',
                                image: 'debian:bookworm-slim',
                                securityContext: { privileged: true },
                                env: [
                                    { name: 'GVISOR_VERSION', value: release.version },
                                    { name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } }
                                ],
                                command: ['/bin/bash', '-c', 'apt-get update && apt-get install -y --no-install-recommends bash ca-certificates curl gpg jq util-linux && /scripts/reconcile.sh'],
                                volumeMounts: [
                                    {
                                        name: 'host-root',
                                        mountPath: '/host'
                                    },
                                    {
                                        name: 'scripts',
                                        mountPath: '/scripts',
                                        readOnly: true
                                    }
                                ],
                            }],
                            volumes: [
                                {
                                    name: 'host-root',
                                    hostPath: {
                                        path: '/',
                                        type: 'Directory'
                                    }
                                },
                                {
                                    name: 'scripts',
                                    configMap: {
                                        name: GvisorAddonService.CONFIG_NAME,
                                        defaultMode: 493
                                    }
                                },
                            ],
                        },
                    },
                },
            },
        ];
    }

    private reconcileScript(): string {
        return `#!/usr/bin/env bash
set -euo pipefail

api_server='https://kubernetes.default.svc'
token=$(< /var/run/secrets/kubernetes.io/serviceaccount/token)
ca='/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
namespace='quickstack-gvisor-system'
lease_name='quickstack-gvisor-installer-lock'

api() { curl --fail --silent --show-error --cacert "$ca" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' "$@"; }

acquire_lock() {
  while ! api -X POST "$api_server/apis/coordination.k8s.io/v1/namespaces/$namespace/leases" --data "{\\"metadata\\":{\\"name\\":\\"$lease_name\\"},\\"spec\\":{\\"holderIdentity\\":\\"$NODE_NAME\\",\\"leaseDurationSeconds\\":120}}"; do
    sleep 10
  done
}

release_lock() { api -X DELETE "$api_server/apis/coordination.k8s.io/v1/namespaces/$namespace/leases/$lease_name" >/dev/null || true; }
trap release_lock EXIT

cordon() { api -X PATCH "$api_server/api/v1/nodes/$NODE_NAME" -H 'Content-Type: application/merge-patch+json' --data '{"spec":{"unschedulable":true}}' >/dev/null; }
uncordon() { api -X PATCH "$api_server/api/v1/nodes/$NODE_NAME" -H 'Content-Type: application/merge-patch+json' --data '{"spec":{"unschedulable":null}}' >/dev/null; }
label_ready() { api -X PATCH "$api_server/api/v1/nodes/$NODE_NAME" -H 'Content-Type: application/merge-patch+json' --data "{\\"metadata\\":{\\"labels\\":{\\"quickstack.dev/gvisor\\":\\"true\\",\\"quickstack.dev/gvisor-version\\":\\"$GVISOR_VERSION\\"}}}" >/dev/null; }

install_host_runtime() {
  cat > /host/tmp/quickstack-gvisor-install.sh <<'HOST_SCRIPT'
#!/bin/bash
set -euo pipefail
version="$1"
. /etc/os-release
case "$ID" in debian|ubuntu) ;; *) echo "Unsupported operating system: $ID"; exit 1;; esac
case "$(uname -m)" in x86_64|aarch64) ;; *) echo "Unsupported architecture"; exit 1;; esac
test "$(printf '%s\\n' '5.6' "$(uname -r | cut -d- -f1)" | sort -V | head -n1)" = '5.6'
apt-get update
apt-get install -y --no-install-recommends apt-transport-https ca-certificates curl gnupg
curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases $version main" > /etc/apt/sources.list.d/gvisor.list
apt-get update
apt-get install -y runsc
config_dir=/var/lib/rancher/k3s/agent/etc/containerd
template="$config_dir/config-v3.toml.tmpl"
test -f "$template" || template="$config_dir/config.toml.tmpl"
mkdir -p "$config_dir"
touch "$template"
grep -q 'quickstack-gvisor-start' "$template" || cat >> "$template" <<'TOML'
# quickstack-gvisor-start
[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.gvisor]
  runtime_type = "io.containerd.runsc.v1"
# quickstack-gvisor-end
TOML
systemctl restart k3s || systemctl restart k3s-agent
HOST_SCRIPT
  chmod 700 /host/tmp/quickstack-gvisor-install.sh
  chroot /host /bin/bash /tmp/quickstack-gvisor-install.sh "$GVISOR_VERSION"
}

acquire_lock
cordon
install_host_runtime
label_ready
uncordon
sleep infinity
`;
    }
}

const gvisorAddonService = new GvisorAddonService();
export default gvisorAddonService;
