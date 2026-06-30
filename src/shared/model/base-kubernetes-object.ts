import { V1ObjectMeta } from '@kubernetes/client-node';

export interface KubernetesResource<
    TSpec = unknown,
    TStatus = unknown
> {
    apiVersion?: string;
    kind?: string;
    metadata?: any;
    spec: TSpec;
    status?: TStatus;
}