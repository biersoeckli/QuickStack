# Template website URL research

Checked on 2026-09-04. Each URL was requested with `curl -L --max-time 20`.
Prefer the official source repository. The destination itself is the primary
source for the corresponding template.

| Template | Preferred `websiteUrl` | HTTP result |
| --- | --- | --- |
| Adminer | https://github.com/vrana/adminer | 200 |
| Chisel Tunnel | https://github.com/jpillora/chisel | 200 |
| Docmost | https://github.com/docmost/docmost | 200 |
| Dozzle | https://github.com/amir20/dozzle | 200 |
| draw.io | https://github.com/jgraph/drawio | 200 |
| Drone CI | https://github.com/drone/drone | 200 after redirect to `harness/harness` |
| Duplicati | https://github.com/duplicati/duplicati | 200 |
| Element Web | https://github.com/element-hq/element-web | 200 |
| File Browser | https://github.com/filebrowser/filebrowser | 200 |
| Forgejo | https://codeberg.org/forgejo/forgejo | 200 |
| Ghost | https://github.com/TryGhost/Ghost | 200 |
| Gitea | https://github.com/go-gitea/gitea | 200 |
| Grafana | https://github.com/grafana/grafana | 200 |
| Harbor Registry | https://github.com/goharbor/harbor | 200 |
| HedgeDoc | https://github.com/hedgedoc/hedgedoc | 200 |
| Home Assistant | https://github.com/home-assistant/core | 200 |
| Huginn | https://github.com/huginn/huginn | 200 |
| Immich | https://github.com/immich-app/immich | 200 |
| Jellyfin | https://github.com/jellyfin/jellyfin | 200 |
| Jenkins | https://github.com/jenkinsci/jenkins | 200 |
| Libredesk | https://github.com/abhinavxd/libredesk | 200 |
| LiteLLM | https://github.com/BerriAI/litellm | 200 |
| Mattermost | https://github.com/mattermost/mattermost | 200 |
| MinIO | https://github.com/minio/minio | 200 |
| n8n | https://github.com/n8n-io/n8n | 200 |
| Navidrome | https://github.com/navidrome/navidrome | 200 |
| Nextcloud | https://github.com/nextcloud/server | 200 |
| NGINX | https://github.com/nginx/nginx | 200 |
| Node-RED | https://github.com/node-red/node-red | 200 |
| Open WebUI | https://github.com/open-webui/open-webui | 200 |
| Outline | https://github.com/outline/outline | 200 |
| PhotoPrism | https://github.com/photoprism/photoprism | 200 |
| Plausible Analytics | https://github.com/plausible/analytics | 200 |
| Prometheus | https://github.com/prometheus/prometheus | 200 |
| Rocket.Chat | https://github.com/RocketChat/Rocket.Chat | 200 |
| SonarQube | https://github.com/SonarSource/sonarqube | 200 |
| Apache Tika | https://github.com/apache/tika | 200 |
| Uptime Kuma | https://github.com/louislam/uptime-kuma | 200 |
| Vaultwarden | https://github.com/dani-garcia/vaultwarden | 200 |
| Wiki.js | https://github.com/requarks/wiki | 200 |
| WordPress | https://github.com/WordPress/wordpress-develop | 200 |
| MariaDB | https://github.com/MariaDB/server | 200 |
| MongoDB | https://github.com/mongodb/mongo | 200 |
| MySQL | https://github.com/mysql/mysql-server | 200 |
| PostgreSQL | https://github.com/postgres/postgres | 200 |
| Redis | https://github.com/redis/redis | 200 |

## Exceptions

- Forgejo's official source is hosted on Codeberg. The GitHub path
  `github.com/forgejo/forgejo` does not resolve; the official Codeberg source
  above does.
- Drone's official GitHub repository redirects to the current Harness
  repository. The original URL is retained because it is the project-owned
  source URL and remains reachable.
