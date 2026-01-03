import { K3sReleaseResponseSchema, LonghornReleaseResponseSchema } from "@/shared/model/generated-zod/k3s-longhorn-release-schemas";

export interface K3sReleaseInfo {
    version: string;
    channelUrl: string;
}

export interface LonghornReleaseInfo {
    version: string;
    yamlUrl: string;
}

interface ReleaseResponse {
    prodInstallVersion: string;
    canaryInstallVersion: string;
}

interface K3sReleaseResponse extends ReleaseResponse {
    prod: K3sReleaseInfo[];
    canary: K3sReleaseInfo[];
}

interface LonghornReleaseResponse extends ReleaseResponse {
    prod: LonghornReleaseInfo[];
    canary: LonghornReleaseInfo[];
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
        const reponseJson = await response.json();
        return K3sReleaseResponseSchema.parse(reponseJson);
    }

    private async getLonghornVersioninfo(): Promise<LonghornReleaseResponse> {
        // TODO: Replace with actual API call when deployed
        return JSON.parse(`{
    "prod": [
        {
            "version": "v1.7.2",
            "yamlUrl": "https://raw.githubusercontent.com/longhorn/longhorn/v1.7.2/deploy/longhorn.yaml"
        }
    ],
    "canary": [
        {
            "version": "v1.7.2",
            "yamlUrl": "https://raw.githubusercontent.com/longhorn/longhorn/v1.7.2/deploy/longhorn.yaml"
        },
        {
            "version": "v1.8.2",
            "yamlUrl": "https://raw.githubusercontent.com/longhorn/longhorn/v1.8.2/deploy/longhorn.yaml"
        },
        {
            "version": "v1.9.2",
            "yamlUrl": "https://raw.githubusercontent.com/longhorn/longhorn/v1.9.2/deploy/longhorn.yaml"
        },
        {
            "version": "v1.10.1",
            "yamlUrl": "https://raw.githubusercontent.com/longhorn/longhorn/v1.10.1/deploy/longhorn.yaml"
        }
    ]
}`);
        const response = await fetch(`${this.API_BASE_URL}/longhorn-versions.json`, {
            cache: 'no-cache',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Longhorn version info from API: HTTP ${response.status} ${response.statusText}`);
        }
        const responseJson = await response.json();
        return LonghornReleaseResponseSchema.parse(responseJson);
    }

    public async getProdK3sReleaseInfo(): Promise<K3sReleaseInfo[]> {
        const releaseInfo = await this.getK3sVersioninfo();
        return releaseInfo.prod;
    }

    public async getCanaryK3sReleaseInfo(): Promise<K3sReleaseInfo[]> {
        const releaseInfo = await this.getK3sVersioninfo();
        return releaseInfo.canary;
    }

    public async getProdLonghornReleaseInfo(): Promise<LonghornReleaseInfo[]> {
        const releaseInfo = await this.getLonghornVersioninfo();
        return releaseInfo.prod;
    }

    public async getCanaryLonghornReleaseInfo(): Promise<LonghornReleaseInfo[]> {
        const releaseInfo = await this.getLonghornVersioninfo();
        return releaseInfo.canary;
    }
}

export const qsVersionInfoAdapter = new QsVersionInfoAdapter();