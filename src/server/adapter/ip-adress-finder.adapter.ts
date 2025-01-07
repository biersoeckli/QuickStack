class IpAddressFinder {

    public async getPublicIpOfServer(): Promise<string> {
        // source: https://www.ipify.org
        const response = await fetch('https://api.ipify.org?format=json') // ipv6 is on other domain https://api6.ipify.org?format=json
        const data = await response.json()
        return data?.ip || undefined;
    }
}

const ipAddressFinderAdapter = new IpAddressFinder();
export default ipAddressFinderAdapter;