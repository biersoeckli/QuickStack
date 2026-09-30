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
        description: 'Provides the optional gVisor runtime on supported cluster nodes.',
        documentationUrl: 'https://gvisor.dev/docs/user_guide/install/',
        managedNamespaces: [GvisorAddonService.NAMESPACE], canUninstall: false,
        updateWarning: {
            title: 'This changes every schedulable node:',
            items: [
                'gVisor cannot be removed through QuickStack once installed.',
                'Each node is cordoned and K3s is restarted serially. Workloads are not drained.',
                'A single-server control plane is briefly unavailable while its K3s service restarts.',
                'You have to restart ALL servers in your cluster after successfull installation.',
            ]
        },
    };

    constructor() { super('gvisor'); }

    async getStatus(): Promise<AddonStatus> {
        const active = this.getActiveOperation();
        if (active) {
            return { status: active };
        }

        return this.getStatusRaw();
    }

    private async getStatusRaw(): Promise<AddonStatus> {
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
            const desiredPods = daemonSet.status?.desiredNumberScheduled ?? 0;
            const availablePods = daemonSet.status?.numberAvailable ?? 0;
            if (availablePods < desiredPods) {
                return {
                    status: 'updating',
                    installedVersion: desired,
                    message: 'Waiting for the gVisor installer DaemonSet.'
                };
            }
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
            const status = await this.getStatusRaw();
            if (status.status !== 'notInstalled') {
                throw new ServiceException('gVisor is already installed or installation is in progress.');
            }
            return this.reconcile(GvisorAddonService.RELEASES[0]);
        });
    }

    async getAvailableUpdate(): Promise<AddonRelease | undefined> {
        const status = await this.getStatusRaw();
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
                    { apiGroups: ['coordination.k8s.io'], resources: ['leases'], verbs: ['get', 'create', 'update', 'patch', 'delete'] },
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

# Kubernetes API connection for this DaemonSet's ServiceAccount.
api_server='https://kubernetes.default.svc'
token=$(< /var/run/secrets/kubernetes.io/serviceaccount/token)
ca='/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
namespace='quickstack-gvisor-system'
lease_name='quickstack-gvisor-installer-lock'
lease_url="$api_server/apis/coordination.k8s.io/v1/namespaces/$namespace/leases/$lease_name"

log() { echo "[$(date --utc +%Y-%m-%dT%H:%M:%SZ)] [gvisor-installer] [$NODE_NAME] $*"; }

# All Kubernetes API calls authenticate with the mounted ServiceAccount token.
api() { curl --fail --silent --show-error --cacert "$ca" -H "Authorization: Bearer $token" "$@"; }

# Only one node may change its host runtime at a time.
# A Lease survives a Pod restart long enough for another Installer Pod to recover it.
acquire_lock() {
  log 'Waiting to acquire the cluster-wide installation Lease.'
  while true; do
    now=$(date --utc +%Y-%m-%dT%H:%M:%S.000000Z)
    lease="{\\"metadata\\":{\\"name\\":\\"$lease_name\\"},\\"spec\\":{\\"holderIdentity\\":\\"$NODE_NAME\\",\\"leaseDurationSeconds\\":45,\\"acquireTime\\":\\"$now\\",\\"renewTime\\":\\"$now\\"}}"
    create_status=$(curl --silent --output /tmp/quickstack-gvisor-lease-response --write-out '%{http_code}' --cacert "$ca" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -X POST "$api_server/apis/coordination.k8s.io/v1/namespaces/$namespace/leases" --data "$lease")
    if [[ "$create_status" == '201' ]]; then
      log 'Acquired installation Lease.'
      return
    fi

    if [[ "$create_status" != '409' ]]; then
      cat /tmp/quickstack-gvisor-lease-response >&2
      exit 1
    fi

    # Another Pod owns the Lease. Inspect it and take over only after expiry.
    existing=$(api "$lease_url")
    holder=$(jq -r '.spec.holderIdentity // empty' <<< "$existing")
    renew_time=$(jq -r '.spec.renewTime // empty' <<< "$existing")
    creation_time=$(jq -r '.metadata.creationTimestamp // empty' <<< "$existing")
    duration=$(jq -r '.spec.leaseDurationSeconds // 45' <<< "$existing")

    if [[ "$holder" == "$NODE_NAME" ]]; then
      log 'Recovered the Lease held by this Node.'
      return
    fi

    lease_time="$renew_time"
    if [[ -z "$lease_time" ]]; then
      lease_time="$creation_time"
    fi

    expires_at=$(date -u -d "$lease_time + $duration seconds" +%s 2>/dev/null || echo 0)
    if (( expires_at > 0 && expires_at < $(date +%s) )); then
      log "Removing expired Lease held by $holder."
      api -X DELETE "$lease_url" >/dev/null || true
    fi

    sleep 5
  done
}

# Renew while apt and K3s work may take longer than the Lease duration.
release_lock() { api -X DELETE "$api_server/apis/coordination.k8s.io/v1/namespaces/$namespace/leases/$lease_name" >/dev/null || true; }
renew_lock() {
  while true; do
    sleep 15
    now=$(date --utc +%Y-%m-%dT%H:%M:%S.000000Z)
    api -X PATCH "$lease_url" -H 'Content-Type: application/merge-patch+json' --data "{\\"spec\\":{\\"holderIdentity\\":\\"$NODE_NAME\\",\\"leaseDurationSeconds\\":45,\\"renewTime\\":\\"$now\\"}}" >/dev/null
  done
}

# Cleanup releases only a Lease owned by this Pod.
renew_pid=''
holds_lock=false
cleanup() {
  if [[ -n "$renew_pid" ]]; then
    kill "$renew_pid" 2>/dev/null || true
  fi
  if [[ "$holds_lock" == true ]]; then
    log 'Releasing installation Lease during cleanup.'
    release_lock
  fi
}
trap cleanup EXIT

# Cordon prevents new workloads during the runtime and K3s changes. It never drains Pods.
cordon() { log 'Cordoning Node.'; api -X PATCH "$api_server/api/v1/nodes/$NODE_NAME" -H 'Content-Type: application/merge-patch+json' --data '{"spec":{"unschedulable":true}}' >/dev/null; }
uncordon() { log 'Uncordoning Node.'; api -X PATCH "$api_server/api/v1/nodes/$NODE_NAME" -H 'Content-Type: application/merge-patch+json' --data '{"spec":{"unschedulable":null}}' >/dev/null; }
label_ready() { api -X PATCH "$api_server/api/v1/nodes/$NODE_NAME" -H 'Content-Type: application/merge-patch+json' --data "{\\"metadata\\":{\\"labels\\":{\\"quickstack.dev/gvisor\\":\\"true\\",\\"quickstack.dev/gvisor-version\\":\\"$GVISOR_VERSION\\"}}}" >/dev/null; }
set_phase() { api -X PATCH "$api_server/api/v1/nodes/$NODE_NAME" -H 'Content-Type: application/merge-patch+json' --data "{\\"metadata\\":{\\"annotations\\":{\\"quickstack.dev/gvisor-phase\\":\\"$1\\"}}}" >/dev/null; }
mark_failed() { set_phase failed || true; }

# Copy the host script into the mounted host filesystem, then execute it in the host namespaces.
install_host_runtime() {
  log 'Starting host runtime installation.'
  cat > /host/tmp/quickstack-gvisor-install.sh <<'HOST_SCRIPT'
#!/bin/bash
set -euo pipefail

host_log() { echo "[$(date --utc +%Y-%m-%dT%H:%M:%SZ)] [gvisor-host-installer] $*"; }

# This section runs on the node host, not inside the Installer container.
version="$1"
. /etc/os-release
host_log "Starting preflight for gVisor release $version on $ID."

# gVisor supports only the chosen operating systems, architectures, and kernel baseline.
case "$ID" in debian|ubuntu) ;; *) echo "Unsupported operating system: $ID"; exit 1;; esac
case "$(uname -m)" in x86_64|aarch64) ;; *) echo "Unsupported architecture"; exit 1;; esac
test "$(printf '%s\\n' '5.6' "$(uname -r | cut -d- -f1)" | sort -V | head -n1)" = '5.6'
config_dir=/var/lib/rancher/k3s/agent/etc/containerd
template="$config_dir/config-v3.toml.tmpl"
if [[ ! -f "$template" ]]; then
  template="$config_dir/config.toml.tmpl"
fi

# K3s templates must include the generated base configuration. Never overwrite an admin template.
ensure_base_template() {
  if [[ ! -f "$template" ]]; then
    mkdir -p "$config_dir"
    printf '{{ template "base" . }}\\n' > "$template"
    return
  fi

  if grep -q 'quickstack-gvisor-start' "$template" && ! grep -q '{{ template "base" . }}' "$template"; then
    sed -i '1i {{ template "base" . }}' "$template"
  fi
}

# Containerd 2.x and 1.x use different plugin paths.
runtime_block() {
  if [[ "$template" == *config-v3.toml.tmpl ]]; then
    cat <<'TOML'
# quickstack-gvisor-start
[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.gvisor]
  runtime_type = "io.containerd.runsc.v1"
# quickstack-gvisor-end
TOML
    return
  fi

  cat <<'TOML'
# quickstack-gvisor-start
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.gvisor]
  runtime_type = "io.containerd.runsc.v1"
# quickstack-gvisor-end
TOML
}

# A restarted Installer Pod reaches this point after K3s restarted. Avoid a second restart.
ensure_base_template
if runsc --version 2>/dev/null | grep -q "$version" && grep -q 'quickstack-gvisor-start' "$template"; then
  host_log 'Pinned runtime and K3s template already match; skipping installation and restart.'
  exit 0
fi
# Configure the official, pinned gVisor apt repository. Do not run apt upgrade.
apt-get update
apt-get install -y --no-install-recommends apt-transport-https ca-certificates curl gnupg
curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases $version main" > /etc/apt/sources.list.d/gvisor.list
apt-get update
apt-get install -y runsc
host_log 'Installed pinned runsc package.'
if ! grep -q 'quickstack-gvisor-start' "$template"; then
  runtime_block >> "$template"
fi
# K3s owns containerd; restart the matching K3s service to load the template.
host_log 'Restarting K3s to load the gVisor runtime configuration.'
systemctl restart k3s || systemctl restart k3s-agent
HOST_SCRIPT
  chmod 700 /host/tmp/quickstack-gvisor-install.sh
  nsenter --target 1 --mount --pid --uts --ipc --net /bin/bash /tmp/quickstack-gvisor-install.sh "$GVISOR_VERSION"
}

# Reconciliation phases are persisted as Node annotations for the UI and retry diagnostics.
acquire_lock
holds_lock=true
renew_lock &
renew_pid=$!
trap mark_failed ERR
set_phase preflight
cordon
set_phase installing
set_phase restarting
install_host_runtime
set_phase verifying
label_ready
uncordon
set_phase ready
kill "$renew_pid"
renew_pid=''
release_lock
holds_lock=false
log "Installation completed successfully for gVisor release $GVISOR_VERSION."
sleep infinity
`;
    }
}

const gvisorAddonService = new GvisorAddonService();
export default gvisorAddonService;
