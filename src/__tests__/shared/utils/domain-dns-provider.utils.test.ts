import { HostnameDnsProviderUtils } from '../../../shared/utils/domain-dns-provider.utils';

describe('DomainDnsProviderUtils', () => {
    describe('isValidTraefikMeDomain', () => {
        it('should return true for valid sslip.io domain with subdomain', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('sub.example.sslip.io')).toBe(true);
        });

        it('should return true for IP-based domain', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('192.168.1.1.sslip.io')).toBe(true);
        });

        it('should return false for simple domain ending with .sslip.io', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('example.sslip.io')).toBe(false);
        });

        it('should return false for domain not ending with .sslip.io', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('example.com')).toBe(false);
        });

        it('should return false for domain with only provider domain', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('sslip.io')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('')).toBe(false);
        });
    });

    describe('containesTraefikMeDomain', () => {
        it('should return true for domain containing .sslip.io', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('example.sslip.io')).toBe(true);
        });

        it('should return true for subdomain containing .sslip.io', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('sub.example.sslip.io')).toBe(true);
        });

        it('should return false for domain not containing .sslip.io', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('example.com')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('')).toBe(false);
        });
    });

    describe('getHostnameForIpAdress', () => {
        it('should convert IP address to hostname with dashes', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('192.168.1.1')).toBe('192-168-1-1.sslip.io');
        });

        it('should handle another IP address format', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('10.0.0.1')).toBe('10-0-0-1.sslip.io');
        });

        it('should handle localhost IP', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('127.0.0.1')).toBe('127-0-0-1.sslip.io');
        });
    });

    describe('ipv4ToHex', () => {
        it('should convert IPv4 address to hex', () => {
            expect(HostnameDnsProviderUtils.ipv4ToHex('192.168.1.1')).toBe('c0a80101');
        });

        it('should convert another IPv4 address to hex', () => {
            expect(HostnameDnsProviderUtils.ipv4ToHex('10.0.0.1')).toBe('0a000001');
        });

        it('should handle leading zeros correctly', () => {
            expect(HostnameDnsProviderUtils.ipv4ToHex('1.2.3.4')).toBe('01020304');
        });

        it('should handle max values correctly', () => {
            expect(HostnameDnsProviderUtils.ipv4ToHex('255.255.255.255')).toBe('ffffffff');
        });
    });
});