import { V1Container } from "@kubernetes/client-node";
import k3s from "../adapter/kubernetes-api.adapter";
import { BUILD_NAMESPACE } from "./registry.service";

const SERVICE_ACCOUNT_NAME = 'qs-build-watcher';
const ROLE_NAME = 'qs-build-watcher-role';
const ROLE_BINDING_NAME = 'qs-build-watcher-binding';

class BuildInitContainerService {

    async ensureRbacResources(): Promise<void> {
        await k3s.applyResource({
            apiVersion: 'v1',
            kind: 'ServiceAccount',
            metadata: {
                name: SERVICE_ACCOUNT_NAME,
                namespace: BUILD_NAMESPACE,
            },
        }, BUILD_NAMESPACE);

        await k3s.applyResource({
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'Role',
            metadata: {
                name: ROLE_NAME,
                namespace: BUILD_NAMESPACE,
            },
            rules: [
                {
                    apiGroups: ['batch'],
                    resources: ['jobs'],
                    verbs: ['get', 'list'],
                },
            ],
        }, BUILD_NAMESPACE);

        await k3s.applyResource({
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind: 'RoleBinding',
            metadata: {
                name: ROLE_BINDING_NAME,
                namespace: BUILD_NAMESPACE,
            },
            subjects: [
                {
                    kind: 'ServiceAccount',
                    name: SERVICE_ACCOUNT_NAME,
                    namespace: BUILD_NAMESPACE,
                },
            ],
            roleRef: {
                kind: 'Role',
                name: ROLE_NAME,
                apiGroup: 'rbac.authorization.k8s.io',
            },
        }, BUILD_NAMESPACE);
    }

    getInitContainer(currentJobName: string, queuedAt: string): V1Container {
        const script = [
            'sleep $((RANDOM % 5 + 1));',
            'while true; do',
            '  DATA=$(kubectl get jobs -n "$NAMESPACE" \\',
            '    -o go-template=\'{{range .items}}{{.metadata.name}}{{"\\t"}}{{index .metadata.annotations "qs-build-queued-at"}}{{"\\t"}}{{range .status.conditions}}{{.type}}={{.status}},{{end}}{{"\\n"}}{{end}}\');',
            '  OLDEST=$(echo "$DATA" | awk \'',
            '    BEGIN { min_ts=""; min_name="" }',
            '    {',
            '      name=$1; ts=$2; conds=$3;',
            '      if (conds ~ /Complete=True/ || conds ~ /Failed=True/) next;',
            '      if (ts == "") next;',
            '      if (min_ts=="" || ts+0 < min_ts+0) { min_ts=ts; min_name=name }',
            '    }',
            '    END { print min_name }',
            '  \');',
            '  if [ "$OLDEST" = "$CURRENT_JOB_NAME" ]; then',
            '    echo "Queue slot acquired (oldest pending build: $CURRENT_JOB_NAME). Starting build.";',
            '    exit 0;',
            '  fi;',
            '  echo "Waiting for older build to finish (oldest pending: $OLDEST). Retrying...";',
            '  sleep $((RANDOM % 5 + 5));',
            'done',
        ].join('\n');

        return {
            name: 'build-queue-init',
            image: 'bitnami/kubectl:latest',
            command: ['sh', '-c'],
            args: [script],
            env: [
                {
                    name: 'NAMESPACE',
                    value: BUILD_NAMESPACE,
                },
                {
                    name: 'CURRENT_JOB_NAME',
                    value: currentJobName,
                },
                {
                    name: 'QUEUED_AT',
                    value: queuedAt,
                },
            ],
        };
    }
}

const buildInitContainerService = new BuildInitContainerService();
export default buildInitContainerService;
