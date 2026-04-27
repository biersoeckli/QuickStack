<img src="/github-assets/quickstack-repo-heading.png" alt="QuickStack Logo" width="100%" />

**QuickStack** is a free, open-source, self-hosted PaaS alternative to Vercel / Netlify / Railway / Heroku for deploying and managing applications and databases on your own VPS, Bare Metal or any other infrastructure.

QuickStack combines the simplicity of a cloud platform with the control of self-hosting. For more information visit our Website [quickstack.dev](https://quickstack.dev).

## Key Features

- **App deployments:** Deploy applications from public or private Git repositories or any docker image from a private or public container registry (e.g. Docker Hub).
- **Database deplyoment:** Create MySQL, MariaDB, PostgreSQL, MongoDB and Redis instances quickly.
- **Multi-server support:** Run applications across multiple server nodes with automatic load balancing and
 persisted storage across nodes.
- **Domains and routing:** Connect custom domains or a preview domain to your applications.
- **Monitoring:** View live-logs, track RAM, CPU and storage usage and configure health checks.
- **Automatic HTTPS:** Generate and manage SSL certificates with Let's Encrypt.
- **Backups:** Schedule backups for application data and databases to an external storage.
- **Multi User support:** Invite team members on your projects with role-based access control.
- **Self-hosted:** Full control over your infrastructure and data without vendor lock-in.

<img src="/github-assets/app-settings-general.png" alt="QuickStack app settings" width="100%" />

## Installation

### Requirements

- A fresh server with at least 2 CPU Cores, 4 GB RAM, 40 GB Storage
- Ubuntu is recommended
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

For detailed setup instructions, visit the [QuickStack documentation](https://quickstack.dev/docs).

## Contributing

Contributions are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## About

QuickStack was originally developed as a student project by [glueh-wyy-huet](https://github.com/glueh-wyy-huet) and [biersoeckli](https://github.com/biersoeckli) at the [Eastern Switzerland University of Applied Sciences](https://ost.ch/). Since then, new features have been added to make QuickStack a powerful and user-friendly platform for self-hosting.

## License

QuickStack is licensed under the GPL-3.0 license.