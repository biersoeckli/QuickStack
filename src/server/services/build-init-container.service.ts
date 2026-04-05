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

    getInitContainer(concurrencyLimit: number, currentJobName: string): V1Container {
        const script = [
            'while true; do',
            '  RUNNING=$(kubectl get jobs -n "$NAMESPACE" -o jsonpath=\'{range .items[*]}{.metadata.name}{"\\t"}{.status.ready}{"\\n"}{end}\' | awk -v cur="$CURRENT_JOB_NAME" \'BEGIN{FS="\\t"} $1 != cur {s+=$2} END{print s+0}\');',
            '  if [ "$RUNNING" -lt "$CONCURRENCY_LIMIT" ]; then',
            '    echo "Slot available ($RUNNING running, limit $CONCURRENCY_LIMIT). Starting build.";',
            '    exit 0;',
            '  fi;',
            '  echo "Too many builds running ($RUNNING/$CONCURRENCY_LIMIT). Waiting...";',
            '  sleep $((RANDOM % 5 + 4));',
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
                    name: 'CONCURRENCY_LIMIT',
                    value: String(concurrencyLimit),
                },
                {
                    name: 'CURRENT_JOB_NAME',
                    value: currentJobName,
                },
            ],
        };
    }
}

const buildInitContainerService = new BuildInitContainerService();
export default buildInitContainerService;
