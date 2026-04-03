# Contributing to QuickStack

Thank you for your interest in contributing to QuickStack! We welcome contributions from the community and are excited to see what you will bring to the project.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue in our [GitHub Issues](https://github.com/biersoeckli/QuickStack/issues) with the following information:
- A clear and descriptive title.
- A detailed description of the problem.
- Steps to reproduce the issue.
- Any relevant logs or screenshots.

### Suggesting Enhancements

If you have an idea for a new feature or an enhancement to an existing feature, please create an issue in our [GitHub Issues](https://github.com/biersoeckli/QuickStack/issues) with the following information:
- A clear and descriptive title.
- A detailed description of the proposed enhancement.
- Any relevant examples or mockups.

### Commit Convention

We use parts of the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for our commit messages.

The commit message should be structured as follows:
```
<type>: <description>

[optional body]

[optional footer]
```

The `type` should be one of the following:
- `feat`: A new feature.
- `fix`: A bug fix.
- `style`: Changes that do not affect the meaning of the code (e.g. whitespace, formatting, etc.).
- `refactor`: Code changes that neither fix a bug nor add a feature.
- `docs`: Documentation changes.
- `test`: Adding or updating tests.
- `chore`: Changes to the build process or auxiliary tools.

The `description` should be a short, descriptive summary of the changes.

The `body` is optional and should provide more detailed information about the changes.

The `footer` is optional and should contain any breaking changes, issues closed, or other relevant information.

Here is an example of a commit message:
```
feat: add new feature

This is a more detailed description of the new feature.

BREAKING CHANGE: this is a breaking change
```

### Submitting Pull Requests

If you would like to contribute code to QuickStack, please follow these steps:
1. Fork the repository and create your branch from `main`.
2. If you have added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code lints.
5. Submit a pull request to the `main` branch.

For each merged pull request a docker image for the canary tag will be created.

### Running Tests

To run the tests locally, use the following command:
```sh
yarn test
```

### Environment Setup

To set up a development environment, use the provided devcontainer configuration. This will set up a development environment with all necessary dependencies and the correct Node version.

In order to run QuickStack, a kubernetes (k3s) cluster is required. There are two ways to connect the devcontainer to a Kubernetes cluster:

#### Option 1: Local Docker k3s (simple, limited)

The devcontainer includes a lightweight k3s cluster running as a Docker container. This is the easiest way to get started and is sufficient for most development and unit testing.

**Limitations:** This local cluster does not include Longhorn (persistent storage) or cert-manager (HTTPS). As a result, you cannot fully test features that rely on volumes or browse deployed apps via HTTPS.

To use this option:
1. Copy `.devcontainer/devcontainer.env_template` to `.devcontainer/devcontainer.env`.
2. Make sure `USE_LOCAL_DOCKER_K3S=true` is set in `devcontainer.env`.
3. Open the project in the devcontainer — the kubeconfig will be configured automatically.

#### Option 2: External VM / VPS with full QuickStack setup (recommended for full testing)

To test all QuickStack features (Longhorn volumes, HTTPS, deployed app access), a VM or VPS with a full QuickStack installation is required.

1. Install QuickStack on the VPS/VM by running the following command:
   ```sh
   curl -sfL https://get.quickstack.dev/setup.sh | sh -
   ```
2. Copy the kubeconfig from the VM (`/etc/rancher/k3s/k3s.yaml`) to `kube-config.config` in the root of the project.
3. add insecure-skip-tls-verify: true to the cluster configuration in `kube-config.config` (see example below).
4. Copy `.devcontainer/devcontainer.env_template` to `.devcontainer/devcontainer.env` and set `USE_LOCAL_DOCKER_K3S=false`.

Example `kube-config.config`:
```yaml
apiVersion: v1
clusters:
- cluster:
    insecure-skip-tls-verify: true
    server: https://SOME-IP-ADDRESS-OR-HOSTNAME:6443
  name: default
contexts:
- context:
    cluster: default
    namespace: registry-and-build
    user: default
  name: default
current-context: default
kind: Config
users:
- name: default
  user:
    client-certificate-data: .....
    client-key-data: .....
```

If you run into any issues, feel free to reach out and open an issue.

#### Install Dependencies
```sh
yarn install
```

#### Start Development Server
```sh
yarn dev
```

### License
By contributing to QuickStack, you agree that your contributions will be licensed under the GPL-3.0 license.
