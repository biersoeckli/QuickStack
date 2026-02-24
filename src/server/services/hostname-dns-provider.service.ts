import { ServiceException } from "@/shared/model/service.exception.model";
import paramService, { ParamService } from "./param.service";
import { HostnameDnsProviderUtils } from "@/shared/utils/domain-dns-provider.utils";

/**
 * Service for Domaing DNS providers like sslip.io.
 * --> QuickStack uses own quickstack.me domain.
 */
class HostnameDnsProviderService {

    async getDomainForApp(appId: string, prefix?: string) {
        const publicIpv4 = await paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS);
        if (!publicIpv4) {
            throw new ServiceException('Please set the main public IPv4 address in the QuickStack settings first.');
        }
        if (prefix) {
            return `${prefix}-${appId}.${HostnameDnsProviderUtils.getHostnameForIpAdress(publicIpv4)}`;
        }
        return `${appId}.${HostnameDnsProviderUtils.getHostnameForIpAdress(publicIpv4)}`;
    }

      async getHexDomainForApp(appId: string, prefix?: string) {
        const publicIpv4 = await paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS);
        if (!publicIpv4) {
            throw new ServiceException('Please set the main public IPv4 address in the QuickStack settings first.');
        }
        if (prefix) {
            return `${prefix}-${appId}.${HostnameDnsProviderUtils.getHexHostnameForIpAddress(publicIpv4)}`;
        }
        return `${appId}.${HostnameDnsProviderUtils.getHexHostnameForIpAddress(publicIpv4)}`;
    }
}

const hostnameDnsProviderService = new HostnameDnsProviderService();
export default hostnameDnsProviderService;