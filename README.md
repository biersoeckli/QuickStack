<div align="center">

<img src="/github-assets/quickstack-icon.svg" alt="QuickStack Logo" style="width: 70px;" />

<h1>QuickStack</h1>

Free, open-source, self-hosted PaaS alternative to Vercel, Netlify, Railway and Heroku.

[Quick Start](https://quickstack.dev/docs/tutorials/installation) • [Website](https://quickstack.dev) • [Docs](https://quickstack.dev/docs)


[![GitHub stars](https://img.shields.io/github/stars/biersoeckli/QuickStack?style=social)](https://github.com/biersoeckli/QuickStack/stargazers) [![GitHub license](https://img.shields.io/github/license/biersoeckli/QuickStack?color=22c55e)](https://github.com/biersoeckli/QuickStack/blob/main/LICENSE) [![GitHub release](https://img.shields.io/github/v/release/biersoeckli/QuickStack?color=22c55e)](https://github.com/biersoeckli/QuickStack/releases) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/biersoeckli/QuickStack)

</div>

Deploy and manage **applications** and **databases** on your own VPS, Bare Metal or any other infrastructure through a clean web interface. QuickStack combines the simplicity and scalability of modern cloud platforms with the control of self-hosting.

<img src="/github-assets/quickstack-github-readme-demo-video.gif" alt="QuickStack Logo" style="width: 100%; border: 1px solid #D3D3D3; border-radius: 25px;" />
<div align="center">

*Deploying a Next.JS app with PostgreSQL.*

</div>

## Installation

### Requirements

- A fresh server with at least 2 CPU Cores, 4 GB RAM, 40 GB Storage
- Ubuntu/Debian is recommended
- SSH access to the server

### Install QuickStack

Open the terminal on your server and run:

```bash
curl -sfL https://get.quickstack.dev/setup.sh | sh -
```

After installation, open QuickStack in your browser and start deploying your applications. For detailed setup instructions, visit the [docs](https://quickstack.dev/docs).

## Key Features

- **Flexible deployments:** Deploy from public or private Git repos and registries using Railpack, guided framework builds, or your own Dockerfile.
- **Framework builds:** Deploy Next.js, React, Angular, Nuxt, Astro, and SvelteKit with preconfigured build commands, output paths, and ports—then adjust them when your project needs it.
- **Project Canvas:** Manage each project's Apps, databases, network connections, configuration, builds, logs, backups, and lifecycle actions from one visual workspace.
- **One-click apps and databases:** Launch popular apps, PostgreSQL, MySQL, MariaDB, MongoDB, and Redis in seconds.
- **Runtime controls:** Scale replicas, set CPU and memory resources, and configure health checks, environment variables, Dockerfile build arguments, and file mounts.
- **Multi-server support:** Add nodes and keep persistent data on replicated Longhorn volumes.
- **Secure networking:** Isolate apps by default and add unlimited custom domains with automatic Let's Encrypt SSL.
- **Monitoring:** Stream logs and monitor CPU, RAM, storage, and health in real time.
- **Backups you control:** Schedule volume backups to S3-compatible storage, optionally run them before deployments, and create native database dumps.
- **Team-ready access:** Control project and app access with user groups, roles, OIDC SSO, 2FA, and expiring API keys.
- **Automation and rollbacks:** Deploy via webhook or REST API and roll back to a previous version in one click.
- **MCP integration (canary):** Enable the remote Model Context Protocol server for controlled QuickStack access from compatible AI clients.
- **Self-hosted and open source:** Install with one command, update from the UI, and avoid lock-in with GPL-3.0 source code.

<img src="/github-assets/qs-app-overview.png" alt="QuickStack app overview" width="100%" />

## How QuickStack Compares

QuickStack is a self-hosted alternative to platforms like [Coolify](https://coolify.io), [Dokku](https://dokku.com), [Dokploy](https://dokploy.com), [Portainer](https://www.portainer.io) and [CapRover](https://caprover.com). Under the hood, QuickStack installs and manages [K3s](https://docs.k3s.io/), a lightweight Kubernetes distribution, together with [Longhorn](https://longhorn.io/docs/latest/what-is-longhorn/) for distributed persistent storage across nodes. This gives you proven Kubernetes primitives such as scheduling, services, ingress, persistent volumes, jobs, probes and multi-node orchestration through a simple web interface for day-to-day deployments. No knowledge of Kubernetes is required to use QuickStack.


## Contributing

Contributions are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Security

To report a vulnerability privately, see [SECURITY.md](SECURITY.md).

## About

QuickStack was originally developed as a student project by [glueh-wyy-huet](https://github.com/glueh-wyy-huet) and [biersoeckli](https://github.com/biersoeckli) at the [Eastern Switzerland University of Applied Sciences](https://ost.ch/). Since then, new features have been added to make QuickStack a powerful and user-friendly platform for self-hosting.

## Related Repositories

- [biersoeckli/QuickStack-Docs](https://github.com/biersoeckli/QuickStack-Docs): The official documentation for QuickStack, including tutorials, guides and API references.
- [biersoeckli/QuickStack-sdk](https://github.com/biersoeckli/QuickStack-sdk): The official JS/TS SDK for the QuickStack API, allowing developers to interact with QuickStack programmatically.
- [biersoeckli/QuickStack-auth-proxy](https://github.com/biersoeckli/QuickStack-auth-proxy): A reverse proxy for QuickStack that handles authentication and authorization for certain services.

## License

QuickStack is licensed under the GPL-3.0 license.
