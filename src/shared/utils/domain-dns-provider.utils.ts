/**
 * Utils for a provider wich supports domains like xip.io or traefik.me.
 * In first versions of QuickStack traefik.me was used. Due to availability issues with traefik.me,
 * it was replaced with https://sslip.io and custom domain quickstack.me.
 */
export class HostnameDnsProviderUtils {

    public static readonly PROVIDER_HOSTNAME = 'quickstack.me';
    private static readonly PROVIDER_HOSTNAME_SUFFIX = `.${this.PROVIDER_HOSTNAME}`;

    static getHostnameForIpAdress(ipv4Address: string): string {
        const traefikFriendlyIpv4 = ipv4Address.split('.').join('-');
        return `${traefikFriendlyIpv4}.${this.PROVIDER_HOSTNAME}`;
    }

    static getHexHostnameForIpAddress(ipv4Address: string): string {
        const traefikFriendlyIpv4 = this.ipv4ToHex(ipv4Address)
        return `${traefikFriendlyIpv4}.${this.PROVIDER_HOSTNAME}`;
    }

    static isValidDnsProviderHostname(domain: string): boolean {
        return this.containsDnsProviderHostname(domain) //&& domain.replace(this.PROVIDER_HOSTNAME_SUFFIX, '').includes('.');
    }

    static containsDnsProviderHostname(domain: string): boolean {
        return domain.includes(this.PROVIDER_HOSTNAME_SUFFIX);
    }

    static ipv4ToHex(ip: string): string {
        return ip.split('.')
            .map(octet => {
                const hex = parseInt(octet, 10).toString(16);
                return hex.padStart(2, '0');
            }).join('');
    }
}