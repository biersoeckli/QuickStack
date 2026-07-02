
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