# QuickStack

QuickStack deploys applications from container images or Git repositories into a managed cluster.

## Language

**App**:
A deployable workload managed by QuickStack.

**Agent**:
A long-lived, isolated container workspace managed by QuickStack for AI-assisted work.
_Avoid_: App, fixed opencode runtime, automation run

**Agent Name**:
A user-defined label for an **Agent** that does not have to be unique.
_Avoid_: agent id, Kubernetes name

**Agent Runtime Secret**:
Sensitive runtime context injected into a running **Agent**.
_Avoid_: public agent config, plain environment config

**Agent Environment Variable**:
A user-defined environment value for an **Agent** whose value is stored encrypted by QuickStack.
_Avoid_: plain env var, app env var

**Agent Rate Limits**:
CPU and memory requests and limits stored as integers (millicores for CPU, MB for memory) that control Kubernetes resource allocation per sandbox container instance.
_Avoid_: resource quantities, K8s resource strings

**Agent Container Configuration**:
Runtime startup settings for an **Agent** container, including command, arguments, and pre-warmed sandbox count.
_Avoid_: opencode config, app container config

**Agent Warm Pool Replicas**:
The number of pre-warmed idle sandbox instances QuickStack keeps available for an **Agent**.
_Avoid_: app replicas, running agent instances

**Agent Source**:
The **Source** QuickStack uses to build or run an **Agent**.
_Avoid_: agent config, general settings

**Agent Build Output**:
The internal container image produced from an **Agent Source** and used by the Agent's SandboxTemplate.
_Avoid_: agent source, saved container image source

**Agent Model Configuration**:
The **LLM Gateway** and **LiteLLM Model Alias** selected for an **Agent**.
_Avoid_: agent source when only model access is meant

**Agent Template**:
A reusable definition that can create one or more preconfigured **Agents** and their supporting Agent-specific resources.
_Avoid_: fixed opencode runtime, app template when referring to Agent creation

**Deploy (Agent)**:
The explicit action that reconciles a saved **Agent** configuration from the database to Kubernetes SandboxTemplate and SandboxWarmPool resources.
_Avoid_: auto-save, save-and-apply

**LLM Gateway**:
A QuickStack-managed connection to a LiteLLM-compatible service that brokers model access for **Agents**.
_Avoid_: built-in model provider, hidden control-plane service

**LiteLLM Admin Key**:
A credential that allows QuickStack to manage models and virtual keys on an **LLM Gateway**.
_Avoid_: agent API key, model API key

**LiteLLM Model Alias**:
A model name exposed by an **LLM Gateway** for selection by an **Agent**.
_Avoid_: provider model id when the LiteLLM alias is meant

**Project Type**:
The workload category a **Project** can contain: either App or Agent.
_Avoid_: mixed project, project mode

**Project Workload**:
The kind of deployable resource allowed by a **Project Type**.
_Avoid_: mixed workload, generic app

**Volume**:
A persistent storage mount attached to an **App** or **Agent**, backed by a Kubernetes PersistentVolumeClaim.
_Avoid_: disk, storage, PVC when referring to the domain concept

**App Volume**:
A **Volume** attached to an **App**, optionally shareable with other Apps in the same project.
_Avoid_: app storage, app disk

**Agent Volume**:
A **Volume** attached to an **Agent**, not shareable and without backup scheduling.
_Avoid_: agent storage, agent disk

**File Mount**:
A text file mounted into an **App** or **Agent** container at a configured container path.
_Avoid_: config map when referring to the domain concept, mounted file

**App File Mount**:
A **File Mount** attached to an **App**.
_Avoid_: app config file, app mounted file

**Agent File Mount**:
A **File Mount** attached to an **Agent**.
_Avoid_: agent config file, agent mounted file

**Workload Permission**:
A permission grant for one specific **Project Workload** inside a **Project**.
_Avoid_: app permission when the workload may be an Agent

**Running Workload**:
A **Project Workload** whose runtime instance is ready to serve user interaction or traffic.
_Avoid_: deployed when describing user-visible readiness

**App Project**:
A **Project** whose **Project Type** allows only **Apps**.
_Avoid_: normal project, container project

**Agent Project**:
A **Project** whose **Project Type** allows only **Agents**.
_Avoid_: agent workspace, agent group

**Source**:
The origin QuickStack uses to build or run an **App**.

**Configured Source**:
A **Source** with all required connection details selected and ready to be saved or deployed.
_Avoid_: connected source, selected source when referring to readiness

**Git HTTPS Source**:
A Git repository accessed through an HTTPS clone URL, optionally with username and token credentials.
_Avoid_: git https, HTTPS repo

**Git SSH Source**:
A Git repository accessed through an SSH clone URL using an app-specific deploy key.
_Avoid_: SSH repo

**Container Image Source**:
A container image reference QuickStack uses to run an **App** or **Agent** without building from Git.
_Avoid_: Docker Container when referring to the domain concept

**Deploy Key**:
A public SSH key registered with a Git provider to grant repository access to a **Git SSH Source**.
_Avoid_: SSH key when specifically referring to the provider-side access grant

**Git Branch**:
The named Git ref selected as the source revision stream for an **App** or **Agent**.
_Avoid_: branch name when referring to the selected source branch

**App Node Port**:
A direct node-level exposure that maps a cluster node port to one container port and protocol on an

**REST API Key**:
A user-owned credential for authenticating REST API requests with exactly the same permissions as its owning **User**.
_Avoid_: token, secret, API token (when this specific credential type is meant)

**REST API Key Name**:
A mandatory user-defined label used to identify one **REST API Key** among a user's keys.
_Avoid_: description, alias

**REST API Client**:
An external automation or tool that calls QuickStack via the REST API using a **REST API Key**.
_Avoid_: integration user, bot user

**Deploy Action**:
A REST-triggered action that applies the currently available deployment input for an **App** without forcing a new build.
_Avoid_: redeploy job (when this domain action is meant)

**Build-And-Deploy Action**:
A REST-triggered action that forces a new build for an **App** and deploys that build output.
_Avoid_: deploy, rebuild (when this exact combined action is meant)

**Deployment Request**:
An asynchronous REST request that starts a deployment-related action and returns immediately with a tracking identifier.
_Avoid_: synchronous deploy call, blocking deployment

**Deployment Webhook**:
An existing deployment trigger endpoint that starts deployment by webhook identifier.
_Avoid_: API key deploy endpoint

**API Key Hard Deletion**:
The permanent removal of a **REST API Key** record so it can no longer be used or recovered.
_Avoid_: revoke, deactivate

**POST Upsert**:
A POST-based write operation that creates a resource when no id is provided and updates it when an id is provided.
_Avoid_: strict REST update, PATCH update (when this specific behavior is meant)

**Full Schema Write**:
A **POST Upsert** where every required business field must be provided on every create and update; partial field writes are not supported and all sub-collections are fully replaced by the supplied list.
_Avoid_: partial update, PATCH-style update

**API Key Self-Management**:
Management of a **REST API Key** by its owning **User** through authenticated profile interactions.
_Avoid_: machine-managed keys

**Direct Success Payload**:
A REST success response returns the resource payload directly without a wrapper envelope.
_Avoid_: success envelope, wrapped success response

**Problem Details Error**:
A REST error response follows RFC 9457 Problem Details format.
_Avoid_: custom error envelope

**API Key HMAC Hash**:
A deterministic server-side HMAC-SHA-256 digest of a **REST API Key** used for storage and lookup.
_Avoid_: bcrypt key hash, reversible encryption

**Shared Authorization Check**:
A transport-independent permission check used consistently by both server-side UI actions and REST API handlers.
_Avoid_: duplicate auth logic per endpoint type

**App Project Assignment**:
The project linkage of an **App** set at creation time and immutable afterwards.
_Avoid_: moving app between projects

**Default App Port**:
The automatically created initial app port `80` when a new **App** is created.
_Avoid_: manual initial port requirement

## Relationships

- An **App** can have zero or one **Configured Source**.
- A **Project** has exactly one **Project Type**.
- A **Project Type** is assigned when a **Project** is created and cannot be changed later.
- An **App Project** can contain zero or more **Apps** and no **Agents**.
- An **Agent Project** can contain zero or more **Agents** and no **Apps**.
- An **Agent** belongs to exactly one **Agent Project**.
- An **Agent** has exactly one **Agent Name**.
- An **Agent** has exactly one **Agent Source**.
- An **Agent** has exactly one **Agent Model Configuration**.
- An **Agent** has exactly one set of **Agent Rate Limits** that apply per sandbox container instance.
- An **Agent** has exactly one **Agent Container Configuration**.
- An **Agent Template** can create one or more **Agents**.
- A **Deploy (Agent)** reconciles the saved **Agent** configuration to its Kubernetes SandboxTemplate and SandboxWarmPool.
- An **Agent** can have zero or more **Agent Environment Variables**.
- A running **Agent** has exactly one **Agent Runtime Secret**.
- An **Agent** uses exactly one **LLM Gateway**.
- QuickStack uses a **LiteLLM Admin Key** to list **LiteLLM Model Aliases** and manage Agent virtual keys.
- A **Project Workload** means an **App** inside an **App Project** or an **Agent** inside an **Agent Project**.
- A **Workload Permission** belongs to exactly one **Project Workload**.
- An **App** can have zero or more **App Node Ports**.
- A **Configured Source** belongs to exactly one **App**.
- Only application workloads can use a **Git HTTPS Source** or **Git SSH Source**.
- A **Git HTTPS Source** belongs to exactly one **App**.
- A **Git SSH Source** belongs to exactly one **App**.
- A **Container Image Source** belongs to exactly one **App**.
- A **Git Source** has exactly one selected **Git Branch** before it can be saved.
- A **Git SSH Source** requires a **Deploy Key** before QuickStack offers **Git Branch** selection.
- An **App Node Port** belongs to exactly one **App** and exposes exactly one container port/protocol.
- A **User** can create zero or more **REST API Keys**.
- A **REST API Key** belongs to exactly one **User**.
- A **REST API Key** has exactly one **REST API Key Name**.
- A **REST API Key Name** is unique per **User**.
- A **REST API Key** is persisted as an **API Key HMAC Hash**.
- A **REST API Client** authenticates with exactly one **REST API Key** per request.
- A **REST API Client** can trigger a **Deploy Action** for an **App**.
- A **REST API Client** can trigger a **Build-And-Deploy Action** for an **App**.
- A **Deploy Action** is triggered through a **Deployment Request**.
- A **Build-And-Deploy Action** is triggered through a **Deployment Request**.
- An **App** can be deployed through a **Deployment Webhook** or a REST API deployment action.
- A deleted **REST API Key** uses **API Key Hard Deletion**.
- A **Project** write via REST API uses **POST Upsert**.
- An **App** write via REST API uses **POST Upsert**.
- An **App** created through REST API receives its id from server-side generation.
- An **App Project Assignment** is set once on create and cannot be changed by update.
- An **App** write via REST API uses **Full Schema Write** semantics: all required business fields must be present on every create and update, and all sub-collections are fully replaced.
- An **App** update must include `projectId` and its value must equal the existing **App Project Assignment**.
- A **User** performs **API Key Self-Management** only for their own **REST API Keys**.
- **API Key Self-Management** is implemented through profile UI and Next.js Server Actions, not REST API endpoints.
- A successful **REST API** response uses **Direct Success Payload**.
- A failed **REST API** response uses **Problem Details Error**.
- Each REST API route declares a **Route Input Schema** for every accepted `query`, `params`, or `body` input.
- Each REST API route declares a **Route Response Model** instead of writing success and error schemas inline.
- REST API handlers throw an **API Exception** for expected authorization and not-found failures.
- A **Shared Authorization Check** is used by server actions and REST API handlers.

## Example Dialogue

> **Dev:** "When the user edits a **Git HTTPS Source**, should choosing a **Git Branch** save the **App**?"
> **Domain expert:** "No, selecting the **Git Branch** only updates the current form; the **App** is saved when the user clicks Save."

> **Dev:** "Can QuickStack list branches for a **Git SSH Source** before the provider knows its **Deploy Key**?"
> **Domain expert:** "No, the user must generate the key and register it as a **Deploy Key** with the Git provider before branch selection is shown."

> **Dev:** "Can a user type a **Git Branch** manually when QuickStack cannot load branches?"
> **Domain expert:** "No, the **Git Branch** must be selected from the branches QuickStack loads from the configured Git source."

> **Dev:** "Should QuickStack generate a new **Deploy Key** every time a user edits the Git SSH URL?"
> **Domain expert:** "No, QuickStack reuses the app's existing key unless the user explicitly regenerates it."

> **Dev:** "Should the Source card show Git HTTPS as selected just because it is the database default?"
> **Domain expert:** "No, the card shows an empty connect state until the **App** has a **Configured Source**."

> **Dev:** "What should happen when the user saves a **Configured Source** and deploys immediately?"
> **Domain expert:** "QuickStack saves the **Configured Source**, starts deployment, closes the source dialog, and shows deployment progress in the Overview tab."

> **Dev:** "If an **App** uses an **App Node Port**, should a restrictive ingress policy still block that node-level traffic?"
> **Domain expert:** "No — creating the **App Node Port** is the explicit decision to expose that one container port/protocol through the cluster node."

## Flagged Ambiguities

- "connect to a git https" means configuring a **Git HTTPS Source** for an **App**.
- "no app source chosen" means the **App** has no **Configured Source**, even if storage contains a default source type.
- "Docker Container Image" is the UI label for a **Container Image Source**.
- "branch" means the selected **Git Branch**, not a build branch or deployment branch.
- "node portforwarding" means an **App Node Port**, not an ad hoc developer port-forward session.
- "CRUD REST API" for projects and apps means REST reads/deletes plus **POST Upsert** for create and update.
- "uniform JSON schema with status/data/error" was superseded by **Direct Success Payload** for success and **Problem Details Error** for failures.
- "bcrypt for API key hashing" was superseded by **API Key HMAC Hash**.
- "deployment trigger endpoint" may refer to **Deployment Webhook** or REST deployment endpoints and must be named explicitly.
- "API key management API" is not part of REST `/api/v1`; API key management is UI + Server Actions only.
- "immutable app projectId on update" means the field must always be provided and must equal the existing **App Project Assignment**; it can never be changed or omitted.
