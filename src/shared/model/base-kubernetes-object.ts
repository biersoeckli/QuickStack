import { V1ObjectMeta } from '@kubernetes/client-node';

export interface KubernetesResource<
    TSpec = unknown,
    TStatus = unknown
> {
    apiVersion: string;
    kind: string;
    metadata: V1ObjectMeta;
    spec: TSpec;
    status?: TStatus;
}