# Let Projects Contain Both Apps and Agents

A **Project** no longer has a **Project Type**. Every **Project** can contain zero or more **Apps** and zero or more **Agents** at the same time, so an App and an Agent Sandbox may share one Project. The `projectType` column, the `ProjectType` enum, the per-kind creation guards in the App, Agent, Agent Template, and LiteLLM Gateway code paths, and the `projectType` field of the REST project write and response models are removed. Creating an **Agent** stays gated by the availability of the Agent Sandbox Cluster Add-on, which is now the only capability gate.

The network policy layer already supported mixed workloads: an App rule may target an App or an Agent, while an Agent egress rule may target an App only. This decision keeps that asymmetry — no Agent-to-Agent egress rule is introduced. The **Project Network Graph** now projects both Apps and Agents as nodes and draws App/Agent connections.

## Consequences

- Existing single-category Projects remain valid and silently become general Projects; no workload data migration is required because `App.projectId` and `Agent.projectId` already exist. Only the `projectType` column is dropped.
- The REST project write no longer requires `projectType`, and project responses no longer contain it. This is a breaking change for REST API clients that send or read the field.
- Workload permissions were already modelled on the generic **Project Workload**, so project-level and per-workload permissions are unchanged.
- A mixed Project shares one namespace, so App and Agent resources coexist in the same Kubernetes namespace; existing name prefixes remain sufficient to avoid collisions.
- The Project overview presents Apps and Agents in one combined workload table, and the graph shows Agent nodes. Clicking an Agent navigates to its detail page.
- Rejected alternatives: keeping `projectType` with an added `MIXED` value (keeps the category the change exists to remove) and replacing it with per-Project capability flags (unnecessary while Agent creation is gated only by the Cluster Add-on).
