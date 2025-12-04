import { HostnameDnsProviderUtils } from '../../../shared/utils/domain-dns-provider.utils';

describe('DomainDnsProviderUtils', () => {
    describe('isValidDnsProviderHostname', () => {
        it('should return true for valid quickstack.me domain with subdomain', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('sub.example.quickstack.me')).toBe(true);
        });

        it('should return true for hex IP-based domain', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('c0a80101.quickstack.me')).toBe(true);
        });

        it('should return true for simple domain ending with .quickstack.me', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('example.quickstack.me')).toBe(true);
        });

        it('should return false for domain not ending with .quickstack.me', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('example.com')).toBe(false);
        });

        it('should return false for domain with only provider domain', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('quickstack.me')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(HostnameDnsProviderUtils.isValidDnsProviderHostname('')).toBe(false);
        });
    });

    describe('containsDnsProviderHostname', () => {
        it('should return true for domain containing .quickstack.me', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('example.quickstack.me')).toBe(true);
        });

        it('should return true for subdomain containing .quickstack.me', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('sub.example.quickstack.me')).toBe(true);
        });

        it('should return false for domain not containing .quickstack.me', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('example.com')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(HostnameDnsProviderUtils.containsDnsProviderHostname('')).toBe(false);
        });
    });

    describe('getHostnameForIpAddress', () => {
        it('should convert IP address to hostname with hex format', () => {
            expect(HostnameDnsProviderUtils.getHexHostanmeForIpAddress('192.168.1.1')).toBe('c0a80101.quickstack.me');
        });

        it('should handle another IP address format', () => {
            expect(HostnameDnsProviderUtils.getHexHostanmeForIpAddress('10.0.0.1')).toBe('0a000001.quickstack.me');
        });

        it('should handle localhost IP', () => {
            expect(HostnameDnsProviderUtils.getHexHostanmeForIpAddress('127.0.0.1')).toBe('7f000001.quickstack.me');
        });
    });

    describe('getHostnameForIpAdress', () => {
        it('should convert IP address to hostname with dash-separated format', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('192.168.1.1')).toBe('192-168-1-1.quickstack.me');
        });

        it('should handle another IP address format', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('10.0.0.1')).toBe('10-0-0-1.quickstack.me');
        });

        it('should handle localhost IP', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('127.0.0.1')).toBe('127-0-0-1.quickstack.me');
        });

        it('should handle max values correctly', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('255.255.255.255')).toBe('255-255-255-255.quickstack.me');
        });

        it('should handle minimum values correctly', () => {
            expect(HostnameDnsProviderUtils.getHostnameForIpAdress('0.0.0.0')).toBe('0-0-0-0.quickstack.me');
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