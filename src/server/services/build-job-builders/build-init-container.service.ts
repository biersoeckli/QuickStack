import { V1Container } from "@kubernetes/client-node";
import k3s from "../../adapter/kubernetes-api.adapter";
import { BUILD_NAMESPACE } from "../registry.service";
import { Constants } from "@/shared/utils/constants";

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

    getInitContainer(currentJobName: string, queuedAt: string, maxParallelBuilds: number = Constants.DEFAULT_MAX_PARALLEL_BUILDS): V1Container {
        const maxParallel = Math.min(Constants.MAX_PARALLEL_BUILDS_LIMIT, Math.max(Constants.DEFAULT_MAX_PARALLEL_BUILDS, Math.floor(maxParallelBuilds)));
        const script = [
            'sleep $((RANDOM % 5 + 1));',
            'while true; do',
            '  DATA=$(kubectl get jobs -n "$NAMESPACE" \\',
            '    -o go-template=\'{{range .items}}{{.metadata.name}}{{"\\t"}}{{index .metadata.annotations "qs-build-queued-at"}}{{"\\t"}}{{range .status.conditions}}{{.type}}={{.status}},{{end}}{{"\\n"}}{{end}}\');',
            '  OLDER=$(echo "$DATA" | awk \'',
            '    {',
            '      name=$1; ts=$2; conds=$3;',
            '      if (ts == "") next;',
            '      if (conds ~ /Complete=True/ || conds ~ /Failed=True/) next;',
            '      if (ts+0 < myts+0) older++;',
            '      else if (ts+0 == myts+0 && name < myname) older++;',
            '    }',
            '    END { print older+0 }',
            '  \' myname="$CURRENT_JOB_NAME" myts="$QUEUED_AT");',
            '  if [ "$OLDER" -lt "$MAX_PARALLEL_BUILDS" ]; then',
            '    echo "Queue slot acquired ($OLDER older build(s) pending, max parallel: $MAX_PARALLEL_BUILDS). Starting build.";',
            '    exit 0;',
            '  fi;',
            '  echo "Waiting for older builds to finish (older pending: $OLDER, max parallel: $MAX_PARALLEL_BUILDS). Retrying...";',
            '  sleep $((RANDOM % 5 + 5));',
            'done',
        ].join('\n');

        return {
            name: Constants.QS_BUILD_INIT_CONTAINER_NAME,
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
                {
                    name: 'MAX_PARALLEL_BUILDS',
                    value: maxParallel.toString(),
                },
            ],
        };
    }
}

const buildQueueInitContainer = new BuildInitContainerService();
export default buildQueueInitContainer;
