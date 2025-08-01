import dockerHubApiAdapter from '../../../server/adapter/dockerhub-api.adapter';

// Mock fetch for testing
global.fetch = jest.fn();

describe('DockerHubApiAdapter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getLatestVersion', () => {
        it('should return latest version information', async () => {
            const mockResponse = {
                name: 'latest',
                full_size: 123456789,
                last_updated: '2024-08-01T12:00:00.000000Z',
                last_updater_username: 'quickstack',
                v2: true,
                tag_status: 'active',
                tag_last_pulled: '2024-08-01T11:00:00.000000Z',
                tag_last_pushed: '2024-08-01T10:00:00.000000Z'
            };

            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await dockerHubApiAdapter.getLatestVersion();

            expect(fetch).toHaveBeenCalledWith(
                'https://hub.docker.com/v2/repositories/quickstack/quickstack/tags/latest',
                expect.objectContaining({
                    cache: 'no-cache',
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                })
            );

            expect(result).toEqual({
                tag: 'latest',
                lastUpdated: '2024-08-01T12:00:00.000000Z',
                fullSize: 123456789
            });
        });

        it('should return null when request fails', async () => {
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => 'Tag not found',
            });

            const result = await dockerHubApiAdapter.getLatestVersion();

            expect(result).toBeNull();
        });
    });

    describe('getCanaryVersion', () => {
        it('should return canary version information', async () => {
            const mockResponse = {
                name: 'canary',
                full_size: 123456790,
                last_updated: '2024-08-01T13:00:00.000000Z',
                last_updater_username: 'quickstack',
                v2: true,
                tag_status: 'active',
                tag_last_pulled: '2024-08-01T12:30:00.000000Z',
                tag_last_pushed: '2024-08-01T12:00:00.000000Z'
            };

            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await dockerHubApiAdapter.getCanaryVersion();

            expect(fetch).toHaveBeenCalledWith(
                'https://hub.docker.com/v2/repositories/quickstack/quickstack/tags/canary',
                expect.objectContaining({
                    cache: 'no-cache',
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                })
            );

            expect(result).toEqual({
                tag: 'canary',
                lastUpdated: '2024-08-01T13:00:00.000000Z',
                fullSize: 123456790
            });
        });
    });

    describe('getVersionComparison', () => {
        it('should return both latest and canary version information', async () => {
            const mockLatestResponse = {
                name: 'latest',
                full_size: 123456789,
                last_updated: '2024-08-01T12:00:00.000000Z',
                last_updater_username: 'quickstack',
                v2: true,
                tag_status: 'active',
                tag_last_pulled: '2024-08-01T11:00:00.000000Z',
                tag_last_pushed: '2024-08-01T10:00:00.000000Z'
            };

            const mockCanaryResponse = {
                name: 'canary',
                full_size: 123456790,
                last_updated: '2024-08-01T13:00:00.000000Z',
                last_updater_username: 'quickstack',
                v2: true,
                tag_status: 'active',
                tag_last_pulled: '2024-08-01T12:30:00.000000Z',
                tag_last_pushed: '2024-08-01T12:00:00.000000Z'
            };

            (fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockLatestResponse,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockCanaryResponse,
                });

            const result = await dockerHubApiAdapter.getVersionComparison();

            expect(result).toEqual({
                latest: {
                    tag: 'latest',
                    lastUpdated: '2024-08-01T12:00:00.000000Z',
                    fullSize: 123456789
                },
                canary: {
                    tag: 'canary',
                    lastUpdated: '2024-08-01T13:00:00.000000Z',
                    fullSize: 123456790
                }
            });
        });
    });

    describe('getAllTags', () => {
        it('should return all tags with pagination', async () => {
            const mockResponse = {
                count: 2,
                next: null,
                previous: null,
                results: [
                    {
                        name: 'latest',
                        full_size: 123456789,
                        last_updated: '2024-08-01T12:00:00.000000Z',
                        last_updater_username: 'quickstack',
                        v2: true,
                        tag_status: 'active',
                        tag_last_pulled: '2024-08-01T11:00:00.000000Z',
                        tag_last_pushed: '2024-08-01T10:00:00.000000Z'
                    },
                    {
                        name: 'canary',
                        full_size: 123456790,
                        last_updated: '2024-08-01T13:00:00.000000Z',
                        last_updater_username: 'quickstack',
                        v2: true,
                        tag_status: 'active',
                        tag_last_pulled: '2024-08-01T12:30:00.000000Z',
                        tag_last_pushed: '2024-08-01T12:00:00.000000Z'
                    }
                ]
            };

            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await dockerHubApiAdapter.getAllTags();

            expect(fetch).toHaveBeenCalledWith(
                'https://hub.docker.com/v2/repositories/quickstack/quickstack/tags?page=1&page_size=25',
                expect.objectContaining({
                    cache: 'no-cache',
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                })
            );

            expect(result).toEqual(mockResponse.results);
        });

        it('should return empty array when request fails', async () => {
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error',
            });

            const result = await dockerHubApiAdapter.getAllTags();

            expect(result).toEqual([]);
        });
    });
});
