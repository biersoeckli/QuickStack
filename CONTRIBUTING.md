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
1. Fork the repository and create your branch from `canary`.
2. If you have added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code lints.
5. Submit a pull request to the `canary` branch.

### Running Tests

To run the tests locally, use the following command:
```sh
yarn test
```

### Environment Setup

To setup a developement environment, use the provided devcontainer configuration. This will setup a development environment with all necessary dependencies and the correct node version.

Additionally to the devcontainer, you need a running k3s cluster.
To connect to your own k3s test cluster, provide the kuberentes credentials in the file `k3s-config.yaml` in the root of the project.

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
