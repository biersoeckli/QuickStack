<div align="center">

<img src="/github-assets/qs-logo-header.svg" alt="QuickStack Logo" style="width: 230px;" />

Free, open-source, self-hosted PaaS alternative to Vercel, Netlify, Railway and Heroku.

[Quick Start](https://quickstack.dev/docs/tutorials/installation) • [Website](https://quickstack.dev) • [Docs](https://quickstack.dev/docs)


[![GitHub stars](https://img.shields.io/github/stars/biersoeckli/QuickStack?style=social)](https://github.com/biersoeckli/QuickStack/stargazers) [![GitHub license](https://img.shields.io/github/license/biersoeckli/QuickStack?color=22c55e)](https://github.com/biersoeckli/QuickStack/blob/main/LICENSE) [![GitHub release](https://img.shields.io/github/v/release/biersoeckli/QuickStack?color=22c55e)](https://github.com/biersoeckli/QuickStack/releases)

</div>

Deploy and manage **applications** and **databases** on your own VPS, Bare Metal or any other infrastructure through a clean web interface. QuickStack combines the simplicity and scalability of modern cloud platforms with the control of self-hosting.

<img src="/github-assets/quickstack-github-readme-demo-video.gif" alt="QuickStack Logo" style="width: 100%; border: 1px solid #D3D3D3; border-radius: 25px;" />
<div align="center">

*Deploying a [Next.js app](https://github.com/biersoeckli/modern-beer-app) app with PostgreSQL in under two minutes.*

</div>

## Key Features

- **App deployments:** Deploy from public or private Git repositories or any Docker image from public or private registries.
- **Database deployment:** Create MySQL, MariaDB, PostgreSQL, MongoDB and Redis instances in seconds.
- **Multi-server support:** Run apps across multiple nodes with load balancing and persistent storage.
- **Domains and routing:** Connect custom domains or use preview domains.
- **Monitoring:** View live logs, track CPU, RAM and storage usage, and configure health checks.
- **Automatic HTTPS:** Generate and manage SSL certificates with Let's Encrypt.
- **Backups:** Schedule backups for apps and databases to external storage.
- **Multi-user support:** Invite team members with role-based access control.
- **Self-hosted:** Full control over your infrastructure and data without vendor lock-in.

<img src="/github-assets/qs-app-overview.png" alt="QuickStack app settings" width="100%" />

## How QuickStack Compares

QuickStack sits in the same self-hosted PaaS space as tools like [Coolify](https://coolify.io), [Dokku](https://dokku.com), [Dokploy](https://dokploy.com), [Portainer](https://www.portainer.io) and [CapRover](https://caprover.com), but it takes a more Kubernetes-native approach. Under the hood, QuickStack installs and manages [K3s](https://docs.k3s.io/), a lightweight Kubernetes distribution, together with [Longhorn](https://longhorn.io/docs/latest/what-is-longhorn/) for distributed persistent storage across nodes. This lets QuickStack benefit from stable Kubernetes primitives such as scheduling, services, ingress, persistent volumes, jobs, probes and multi-node orchestration while still providing a simple web interface for day-to-day deployments.

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

For non-interactive installation, provide the network interface manually:

```bash
curl -sfL https://get.quickstack.dev/setup.sh | INSTALL_K3S_INTERFACE=eth0 sh -
```

After installation, open QuickStack in your browser and start deploying your applications.

For detailed setup instructions, visit the [docs](https://quickstack.dev/docs).

## Contributing

Contributions are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## About

QuickStack was originally developed as a student project by [glueh-wyy-huet](https://github.com/glueh-wyy-huet) and [biersoeckli](https://github.com/biersoeckli) at the [Eastern Switzerland University of Applied Sciences](https://ost.ch/). Since then, new features have been added to make QuickStack a powerful and user-friendly platform for self-hosting.

## License

QuickStack is licensed under the GPL-3.0 license.
