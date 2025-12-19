export type TraefikIpPropagationStatus = {
    externalTrafficPolicy?: 'Local' | 'Cluster';
    readyReplicas: number;
    replicas: number;
    restartedAt?: string | null;
};
