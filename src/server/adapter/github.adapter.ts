export interface GithubReleaseInfo {
    version: string;
    url: string;
    publishedAt: string;
    body: string;
}

class GithubAdapter {

    private readonly GITHUB_API_BASE_URL = 'https://api.github.com';

    public async getLatestQuickStackVersion(): Promise<GithubReleaseInfo> {
        const response = await fetch(`${this.GITHUB_API_BASE_URL}/repos/biersoeckli/QuickStack/releases/latest`, {
            cache: 'no-cache',
            method: 'GET',
            headers: {

                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch latest QuickStack version from GitHub: HTTP ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            version: data.tag_name,
            url: data.html_url,
            publishedAt: data.published_at,
            body: data.body
        };
    }

    /* example:
    {
  "url": "https://api.github.com/repos/biersoeckli/QuickStack/releases/267434818",
  "assets_url": "https://api.github.com/repos/biersoeckli/QuickStack/releases/267434818/assets",
  "upload_url": "https://uploads.github.com/repos/biersoeckli/QuickStack/releases/267434818/assets{?name,label}",
  "html_url": "https://github.com/biersoeckli/QuickStack/releases/tag/0.0.6",
  "id": 267434818,
  "author": {
    "login": "biersoeckli",
    "id": 24962453,
    "node_id": "MDQ6VXNlcjI0OTYyNDUz",
    "avatar_url": "https://avatars.githubusercontent.com/u/24962453?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/biersoeckli",
    "html_url": "https://github.com/biersoeckli",
    "followers_url": "https://api.github.com/users/biersoeckli/followers",
    "following_url": "https://api.github.com/users/biersoeckli/following{/other_user}",
    "gists_url": "https://api.github.com/users/biersoeckli/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/biersoeckli/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/biersoeckli/subscriptions",
    "organizations_url": "https://api.github.com/users/biersoeckli/orgs",
    "repos_url": "https://api.github.com/users/biersoeckli/repos",
    "events_url": "https://api.github.com/users/biersoeckli/events{/privacy}",
    "received_events_url": "https://api.github.com/users/biersoeckli/received_events",
    "type": "User",
    "user_view_type": "public",
    "site_admin": false
  },
  "node_id": "RE_kwDONfVBr84P8LtC",
  "tag_name": "0.0.6",
  "target_commitish": "main",
  "name": "0.0.6",
  "draft": false,
  "immutable": false,
  "prerelease": false,
  "created_at": "2025-12-04T13:33:14Z",
  "updated_at": "2025-12-04T13:34:32Z",
  "published_at": "2025-12-04T13:34:32Z",
  "assets": [

  ],
  "tarball_url": "https://api.github.com/repos/biersoeckli/QuickStack/tarball/0.0.6",
  "zipball_url": "https://api.github.com/repos/biersoeckli/QuickStack/zipball/0.0.6",
  "body": "## What's Changed\r\n* fix: use sudo for kubectl commands in setup scripts to ensure proper permissions by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/42\r\n* Feat/replace traefikme dns service by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/48\r\n* feat/upgrade prisma orm to v7 by @biersoeckli in https://github.com/biersoeckli/QuickStack/pull/47\r\n\r\n\r\n**Full Changelog**: https://github.com/biersoeckli/QuickStack/compare/0.0.5...0.0.6",
  "reactions": {
    "url": "https://api.github.com/repos/biersoeckli/QuickStack/releases/267434818/reactions",
    "total_count": 1,
    "+1": 0,
    "-1": 0,
    "laugh": 0,
    "hooray": 0,
    "confused": 0,
    "heart": 1,
    "rocket": 0,
    "eyes": 0
  },
  "mentions_count": 1
}
*/

}


export const githubAdapter = new GithubAdapter();
