import { deriveExtendedConfiguration } from './network-policy-to-extended.derivation';

const appWithTwoPorts = {
    id: 'app-a',
    useNetworkPolicy: true,
    ingressNetworkPolicy: 'ALLOW_ALL',
    egressNetworkPolicy: 'ALLOW_ALL',
    appPorts: [{ port: 80 }, { port: 443 }],
};

const twoPeers = [
    { id: 'db-b', appPorts: [{ port: 5432 }] },
    { id: 'web-c', appPorts: [{ port: 8080 }, { port: 9090 }] },
];

describe('deriveExtendedConfiguration', () => {
    it('derives no rules and disabled Internet for DENY_ALL ingress and egress', () => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: 'DENY_ALL', egressNetworkPolicy: 'DENY_ALL' },
            twoPeers,
        );

        expect(result.allowInternetAccess).toBe(false);
        expect(result.rules).toEqual([]);
    });

    it.each([
        ['ALLOW_ALL', true],
        ['INTERNET_ONLY', true],
        ['NAMESPACE_ONLY', false],
        ['DENY_ALL', false],
    ])('sets allowInternetAccess for egress %s', (egressPolicy, expected) => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: 'DENY_ALL', egressNetworkPolicy: egressPolicy },
            [],
        );

        expect(result.allowInternetAccess).toBe(expected);
        expect(result.rules).toEqual([]);
    });

    it.each([
        ['ALLOW_ALL'],
        ['NAMESPACE_ONLY'],
    ])('creates an ingress rule from every project peer for every own port for ingress %s', (ingressPolicy) => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: ingressPolicy, egressNetworkPolicy: 'DENY_ALL' },
            twoPeers,
        );

        expect(result.rules).toEqual([
            { type: 'INGRESS', targetAppId: 'db-b', port: 80, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'db-b', port: 443, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'web-c', port: 80, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'web-c', port: 443, protocol: 'TCP' },
        ]);
    });

    it.each([
        ['INTERNET_ONLY'],
        ['DENY_ALL'],
    ])('creates no ingress rules for ingress %s', (ingressPolicy) => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: ingressPolicy, egressNetworkPolicy: 'DENY_ALL' },
            twoPeers,
        );

        expect(result.rules).toEqual([]);
    });

    it.each([
        ['ALLOW_ALL'],
        ['NAMESPACE_ONLY'],
    ])('creates an egress rule to every project peer for every peer port for egress %s', (egressPolicy) => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: 'DENY_ALL', egressNetworkPolicy: egressPolicy },
            twoPeers,
        );

        expect(result.rules).toEqual([
            { type: 'EGRESS', targetAppId: 'db-b', port: 5432, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'web-c', port: 8080, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'web-c', port: 9090, protocol: 'TCP' },
        ]);
    });

    it.each([
        ['INTERNET_ONLY'],
        ['DENY_ALL'],
    ])('creates no egress rules for egress %s', (egressPolicy) => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: 'DENY_ALL', egressNetworkPolicy: egressPolicy },
            twoPeers,
        );

        expect(result.rules).toEqual([]);
    });

    it('combines ingress and egress rules for ALLOW_ALL in both directions', () => {
        const result = deriveExtendedConfiguration(appWithTwoPorts, twoPeers);

        expect(result.allowInternetAccess).toBe(true);
        expect(result.rules).toEqual([
            { type: 'INGRESS', targetAppId: 'db-b', port: 80, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'db-b', port: 443, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'web-c', port: 80, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'web-c', port: 443, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'db-b', port: 5432, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'web-c', port: 8080, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'web-c', port: 9090, protocol: 'TCP' },
        ]);
    });

    it('creates no ingress rules when the App has no internal ports', () => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, appPorts: [], egressNetworkPolicy: 'DENY_ALL' },
            twoPeers,
        );

        expect(result.rules).toEqual([]);
    });

    it('creates no egress rule to a peer that has no internal ports', () => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: 'DENY_ALL', egressNetworkPolicy: 'ALLOW_ALL' },
            [{ id: 'empty-peer', appPorts: [] }],
        );

        expect(result.allowInternetAccess).toBe(true);
        expect(result.rules).toEqual([]);
    });

    it('treats an unknown stored policy value as ALLOW_ALL', () => {
        const result = deriveExtendedConfiguration(
            { ...appWithTwoPorts, ingressNetworkPolicy: 'UNKNOWN', egressNetworkPolicy: 'UNKNOWN' },
            twoPeers,
        );

        expect(result.allowInternetAccess).toBe(true);
        expect(result.rules).toEqual([
            { type: 'INGRESS', targetAppId: 'db-b', port: 80, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'db-b', port: 443, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'web-c', port: 80, protocol: 'TCP' },
            { type: 'INGRESS', targetAppId: 'web-c', port: 443, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'db-b', port: 5432, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'web-c', port: 8080, protocol: 'TCP' },
            { type: 'EGRESS', targetAppId: 'web-c', port: 9090, protocol: 'TCP' },
        ]);
    });
});
