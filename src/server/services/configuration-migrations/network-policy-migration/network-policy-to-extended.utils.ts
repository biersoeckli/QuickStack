import { appNetworkPolicy } from '@/shared/model/network-policy.model';

export type NetworkPolicyMigrationAppView = {
    id: string;
    useNetworkPolicy: boolean;
    ingressNetworkPolicy: string;
    egressNetworkPolicy: string;
    appPorts: { port: number }[];
};

export type NetworkPolicyMigrationPeerView = {
    id: string;
    appPorts: { port: number }[];
};

export type NetworkPolicyMigrationRule = {
    type: 'INGRESS' | 'EGRESS';
    targetAppId: string;
    port: number;
    protocol: 'TCP';
};

export type NetworkPolicyMigrationDerivation = {
    allowInternetAccess: boolean;
    rules: NetworkPolicyMigrationRule[];
};

export class NetworkPolicyToExtendedUtils {
    private static normalizePolicy(raw: string): 'ALLOW_ALL' | 'INTERNET_ONLY' | 'NAMESPACE_ONLY' | 'DENY_ALL' {
        const parsed = appNetworkPolicy.safeParse(raw);
        return parsed.success ? parsed.data : 'ALLOW_ALL';
    }

    /**
     * Derives the Extended App Network Policy Configuration that reproduces the
     * behavior of an App's active Simple App Network Policy Configuration.
     * Traefik, backup/db-tool and node-port peers are not part of the rules; the
     * network-policy reconcile derives them from domains, container types and
     * node ports.
     */
    static deriveExtendedConfiguration(
        app: NetworkPolicyMigrationAppView,
        peers: NetworkPolicyMigrationPeerView[],
    ): NetworkPolicyMigrationDerivation {
        const ingressPolicy = NetworkPolicyToExtendedUtils.normalizePolicy(app.ingressNetworkPolicy);
        const egressPolicy = NetworkPolicyToExtendedUtils.normalizePolicy(app.egressNetworkPolicy);

        const rules: NetworkPolicyMigrationRule[] = [];

        if (ingressPolicy === 'ALLOW_ALL' || ingressPolicy === 'NAMESPACE_ONLY') {
            for (const peer of peers) {
                for (const appPort of app.appPorts) {
                    rules.push({
                        type: 'INGRESS',
                        targetAppId: peer.id,
                        port: appPort.port,
                        protocol: 'TCP',
                    });
                }
            }
        }

        if (egressPolicy === 'ALLOW_ALL' || egressPolicy === 'NAMESPACE_ONLY') {
            for (const peer of peers) {
                for (const peerPort of peer.appPorts) {
                    rules.push({
                        type: 'EGRESS',
                        targetAppId: peer.id,
                        port: peerPort.port,
                        protocol: 'TCP',
                    });
                }
            }
        }

        return {
            allowInternetAccess: egressPolicy === 'ALLOW_ALL' || egressPolicy === 'INTERNET_ONLY',
            rules,
        };
    }
}
