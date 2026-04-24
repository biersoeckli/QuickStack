import { K3sReleaseResponseSchema, LonghornReleaseResponseSchema } from "@/shared/model/generated-zod/k3s-longhorn-release-schemas";

export interface QuickStackReleaseInfo {
    version: string;
    url: string;
    publishedAt: string;
    body: string;
}

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

    public async getLatestQuickStackVersion(instanceId?: string): Promise<QuickStackReleaseInfo> {
        const url = new URL(`${this.API_BASE_URL}/versioninfo.json`);
        if (instanceId) {
            url.searchParams.append('instanceId', instanceId);
        }
        const response = await fetch(url.toString(), {
            cache: 'no-cache',
            method: 'GET',
            headers: {

                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch latest QuickStack version: HTTP ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            version: data.tag_name,
            url: data.html_url,
            publishedAt: data.published_at,
            body: data.body
        };

        /* example:
        {
            "version": "0.0.11",
            "url": "https://github.com/biersoeckli/QuickStack/releases/tag/0.0.11",
            "publishedAt": "2026-04-22T08:11:12Z",
            "body": "## What’s New\r\n* Added a queue mechanism to the build process to prevent multiple parallel builds from overloading a QuickStack node\r\n* Added placement options for build jobs in the QuickStack settings\r\n* Added an overview page for all recent builds\r\n* Kubernetes events are now displayed in the deployment logs\r\n* Fixed an error on the backups page that prevented it from loading when a backup location was unreachable\r\n* Optimized build pipelines and devcontainer setup\r\n* Various smaller fixes and improvements\r\n\r\n## What's Changed\r\n* chore: enhance devcontainer setup for local k3s development and updated contribution guidelines by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/81\r\n* fix: implement error handling for external data fetching in backups and monitoring page by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/84\r\n* Feat/placement options for build containers in cluster by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/85\r\n* chore: optimized arm build-and-push on canary and prod release for quickstack image by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/86\r\n* Feat/build process optimizations by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/87\r\n* fix: replaced libredesk logo by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/88\r\n\r\n\r\n**Full Changelog**: https://github.com/biersoeckli/QuickStack/compare/0.0.9...0.0.11"
        }*/
    }
}

export const qsVersionInfoAdapter = new QsVersionInfoAdapter();