Status: ready-for-agent

## Parent

[Agent platform core setup PRD](../PRD:md)

## What to build

Let authorized users create an **Agent** in an **Agent Project** using an Agent Name, default image, LLM Gateway, and live-selected LiteLLM Model Alias. Persist a stable Kubernetes-safe Agent id, reconcile its `SandboxTemplate` and zero-replica `SandboxWarmPool`, and expose the Agent through Project overview and sidebar navigation.

## Acceptance criteria

- [ ] Agent Project overview and sidebar list Agents while App Projects continue listing Apps.
- [ ] Authorized users can create an Agent with a non-unique, renameable Agent Name.
- [ ] Agent creation requires an LLM Gateway and a live-loaded LiteLLM Model Alias, persisting only the selected alias.
- [ ] Agent ids are generated once, remain stable across renames, and produce valid shared Kubernetes resource names.
- [ ] New Agents use the centralized default Agent image.
- [ ] Saving creates or reconciles one `SandboxTemplate` and one zero-replica `SandboxWarmPool` in the Agent Project namespace.
- [ ] Kubernetes definition failure rolls back the DB Agent and leaves no half-created Agent in the UI.
- [ ] Agent Sandbox operations are isolated behind a mockable service or adapter using the documented v1beta1 resources.
- [ ] Tests cover naming, required selections, resource definitions, navigation visibility, and rollback.

## Blocked by

- [01-add-immutable-project-type](./01-add-immutable-project-type.md)
- [03-manage-llm-gateways](./03-manage-llm-gateways.md)
