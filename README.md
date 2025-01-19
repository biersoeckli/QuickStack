# QuickStack

<img  src="/public/quick-stack-logo-light.png" alt="QuickStack Logo" width="300" style="
    display: 'block',
    margin: 'auto',
    marginBottom: '20px'" />

QuickStack is a open source self-hosted Platform-as-a-Service (PaaS) solution designed to simplify the management of containerized applications on Virtual Private Server (VPS) infrastructures.
Developed as part of a student project at the [Eastern Switzerland University of Applied Sciences](https://ost.ch/), QuickStack provides a scalable and cost-effective alternative to commercial cloud PaaS offerings like Vercel, Digital Ocean App Platform or Azure App Service.

## Key Features

* **One-Command Installation:** Deploy QuickStack on a VPS with a single command.
* **Git Integration:** Deploy applications directly from public or private Git repositories.
* **Docker Container Deployment:** Deploy Docker containers from a Docker Hub, a public or a private registry.
* **Live Logging:** Debug running containers with live log streams.
* **Web Terminal:** Access a web-based terminal directly within the container for debugging.
* **SSL Certificate Management:** Automatic SSL certificate generation via Let's Encrypt.
* **Resource Management:** Set resource limits (CPU, RAM, storage) for each application.
* **Monitoring Dashboard:** Track resource consumption and application performance.
* **Cluster Support:** Scale applications across multiple VPS nodes.
* **Persistent Storage:** Cluster-wide persistent storage volumes for applications.

## Getting Started
### Prerequisites
Before getting started, ensure that you have:
* A new virtual private server (VPS) running a Linux distribution (Ubuntu preferred).

### Installation
1. **Connect to your VPS via SSH.**
2. **Run the setup script:**
```bash
curl -sfL https://get.quickstack.dev/setup.sh | sh -
```

Visit our [docs](https://quickstack.dev/docs/intro) for more detailed installation instructions:

## Contributing
Contributions are welcome! Further information on how to contribute can be found in the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License
This project is licensed under the GPL-3.0 license.
