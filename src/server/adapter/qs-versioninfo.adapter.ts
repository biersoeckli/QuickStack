
export interface K3sReleaseInfo {
    version: string;
    channelUrl: string;
}

interface K3sReleaseResponse {
    prod: K3sReleaseInfo[];
    canary: K3sReleaseInfo[];
}

class QsVersionInfoAdapter {

    private readonly API_BASE_URL = 'https://get.quickstack.dev';

    private async getK3sVersioninfo(): Promise<K3sReleaseResponse> {

        return JSON.parse(`{
    "prod": [
        {
            "version": "v1.31",
            "channelUrl": "https://update.k3s.io/v1-release/channels/v1.31"
        }
    ],
    "canary": [
        {
            "version": "v1.31",
            "channelUrl": "https://update.k3s.io/v1-release/channels/v1.31"
        },
        {
            "version": "v1.32",
            "channelUrl": "https://update.k3s.io/v1-release/channels/v1.32"
        },
        {
            "version": "v1.33",
            "channelUrl": "https://update.k3s.io/v1-release/channels/v1.33"
        }
    ]
}`);
        const response = await fetch(`${this.API_BASE_URL}/k3s-versions.json`, {
            cache: 'no-cache',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch latest QuickStack K3s Prod version from API: HTTP ${response.status} ${response.statusText}`);
        }
        return await response.json() as K3sReleaseResponse;
    }

    public async getProdK3sReleaseInfo(): Promise<K3sReleaseInfo[]> {
        const releaseInfo = await this.getK3sVersioninfo();
        return releaseInfo.prod;
    }

    public async getCanaryK3sReleaseInfo(): Promise<K3sReleaseInfo[]> {
        const releaseInfo = await this.getK3sVersioninfo();
        return releaseInfo.canary;
    }
}

export const qsVersionInfoAdapter = new QsVersionInfoAdapter();