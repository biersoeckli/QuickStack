# QuickStack

QuickStack is a open source self-hosted Platform-as-a-Service (PaaS) solution designed to simplify the management of containerized applications on Virtual Private Server (VPS) infrastructures.
Developed as part of a student project at the [Eastern Switzerland University of Applied Sciences](https://ost.ch/), QuickStack provides a scalable and cost-effective alternative to commercial cloud PaaS offerings like Vercel, Digital Ocean App Platform or Azure App Service.

## Key Features

* **Simple Installation:** Deploy QuickStack on a VPS with a single command.
* **Git Integration:** Deploy applications directly from public or private Git repositories.
* **Live Logging:** Debug running containers with live log streams.
* **Web Terminal:** Access a web-based terminal directly within the container for debugging.
* **SSL Certificate Management:** Automatic SSL certificate generation via Let's Encrypt.
* **Resource Management:** Set resource limits (CPU, RAM, storage) for each application.
* **Monitoring Dashboard:** Track resource consumption and application performance.
* **Persistent Storage:** Cluster-wide persistent storage volumes for applications using Longhorn.
* **Cluster Support:** Scale applications across multiple VPS nodes using Kubernetes.

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

## Contributing
Contributions are welcome! If you have ideas for new features or find bugs, please submit an issue or pull request.

## License
This project is licensed under the GPL-3.0 license.
