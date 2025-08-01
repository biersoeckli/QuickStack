interface DockerHubTag {
    name: string;
    full_size: number;
    last_updated: string;
    last_updater_username: string;
    digest: string;
    v2: boolean;
    tag_status: string;
    tag_last_pulled: string;
    tag_last_pushed: string;
}

interface DockerHubTagsResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: DockerHubTag[];
}

interface DockerHubVersionInfo {
    tag: string;
    lastUpdated: string;
    fullSize: number;
    digest: string;
}

class DockerHubApiAdapter {

    private readonly baseUrl = 'https://hub.docker.com/v2/repositories';
    private readonly repository = 'quickstack/quickstack';

    /**
     * Get the latest version information for a specific tag
     */
    async getLatestVersionForTag(tagName: 'latest' | 'canary'): Promise<DockerHubVersionInfo | null> {
        try {
            const response = await fetch(`${this.baseUrl}/${this.repository}/tags/${tagName}`, {
                cache: 'no-cache',
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            await this.checkIfResponseIsOk(response);
            const tagData: DockerHubTag = await response.json();

            return {
                tag: tagData.name,
                digest: tagData.digest, // Assuming digest is the same as name for simplicity
                lastUpdated: tagData.last_updated,
                fullSize: tagData.full_size
            };
        } catch (error) {
            console.error(`Failed to fetch ${tagName} tag information:`, error);
            return null;
        }
    }

    /**
     * Get the latest version information for the 'latest' tag
     */
    async getLatestVersion(): Promise<DockerHubVersionInfo | null> {
        return this.getLatestVersionForTag('latest');
    }

    /**
     * Get the latest version information for the 'canary' tag
     */
    async getCanaryVersion(): Promise<DockerHubVersionInfo | null> {
        return this.getLatestVersionForTag('canary');
    }

    /**
     * Get all tags for the repository (with pagination support)
     */
    async getAllTags(page: number = 1, pageSize: number = 25): Promise<DockerHubTag[]> {
        try {
            const response = await fetch(`${this.baseUrl}/${this.repository}/tags?page=${page}&page_size=${pageSize}`, {
                cache: 'no-cache',
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            await this.checkIfResponseIsOk(response);
            const data: DockerHubTagsResponse = await response.json();
            return data.results;
        } catch (error) {
            console.error('Failed to fetch all tags:', error);
            return [];
        }
    }

    private async checkIfResponseIsOk(response: Response): Promise<void> {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Docker Hub API request failed: ${response.status} ${response.statusText}. ${errorText}`);
        }
    }
}

const dockerHubApiAdapter = new DockerHubApiAdapter();
export default dockerHubApiAdapter;
