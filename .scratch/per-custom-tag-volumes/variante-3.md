# Per-Custom-Tag Agent Volumes — Variante 3 (chosen)

Status: ready-for-agent
Variant: 3 (chosen)
Branch: `feat/unify-project-workloads`

> Variante 3 keeps the durable copy entirely inside the cluster: no S3, no restore/upload container, no SDK copy. A **Custom Tag** gets a stable PersistentVolumeClaim that survives the sandbox, implemented by creating the `Sandbox` directly instead of through `SandboxClaim` + `SandboxTemplate`. Variante 1 (S3 + init/sidecar) and Variante 2 (QuickStack SDK copy) were rejected; ADR 0013 records the decision.

## Problem Statement

An **Agent Volume** is either a **Shared Agent Volume** (`ALL`) or a **Per-Sandbox Agent Volume** (`PER_SANDBOX`). A Per-Sandbox Agent Volume is deleted with its sandbox (ADR 0011), and **Suspend** keeps it only while the sandbox exists (ADR 0012). A Shared Agent Volume is visible to every sandbox of the Agent. Neither gives a user who runs one sandbox per end user (identified by the **Custom Tag**) a private workspace that comes back after the sandbox was stopped, deleted, or expired.

## Solution

Add a third **Volume Type**, `PER_CUSTOM_TAG`: a **Per-Custom-Tag Agent Volume**. Its data belongs to a **Custom Tag**, not to a sandbox, and is a QuickStack-managed PersistentVolumeClaim per tag.

- An Agent that has any `PER_CUSTOM_TAG` volume is started by creating a `Sandbox` object directly (`agents.x-k8s.io/v1beta1`), not a `SandboxClaim` from a `SandboxTemplate`. The existing claim/template/warm-pool path is left untouched for all other Agents.
- Before the Sandbox is created, QuickStack ensures the per-tag PVC exists (create if missing) from the Agent Volume's access mode, storage class, and size, and attaches it through a static `podTemplate.spec.volumes[].persistentVolumeClaim.claimName` (the same mechanism used for `ALL` volumes).
- The PVC is QuickStack-owned, so Stop, deletion, and idle expiry delete the Sandbox and its Pod but never the PVC. Starting a sandbox with the same tag reuses the same workspace.
- `PER_SANDBOX` and `PER_CUSTOM_TAG` are **mutually exclusive on one Agent**; `ALL` may be mixed with `PER_CUSTOM_TAG`.
- No S3 Target, no per-tag database record, no restore/upload containers, no lock or marker.

Captured by ADR 0013 and the **GLOSSARY.md** term **Per-Custom-Tag Agent Volume**.

## User Stories

1. As a QuickStack user, I want to mark an Agent Volume as `PER_CUSTOM_TAG`, so that its data belongs to a Custom Tag instead of a sandbox.
2. As a QuickStack user, I want a `PER_CUSTOM_TAG` volume to allow `ReadWriteOnce`, so that storage classes without `ReadWriteMany` work.
3. As a QuickStack user, I want the volume type, access mode, and storage class of an existing Agent Volume to be immutable, so that existing data is never silently reinterpreted.
4. As a QuickStack user, I want to change the size of a `PER_CUSTOM_TAG` volume, so that its per-tag PVCs grow.
5. As a QuickStack user, I want a sandbox started with Custom Tag `alice` to have its own writable volume at the configured mount path, so that the agent can work normally.
6. As a QuickStack user, I want data the agent wrote under tag `alice` to still be there when I stop the sandbox and later start a new sandbox with tag `alice`, so that the workspace persists across sessions.
7. As a QuickStack user, I want this to also hold after the sandbox was deleted by the idle timeout, so that persistence does not depend on the sandbox.
8. As a QuickStack user, I want tag `bob` to never see tag `alice`'s data, so that tags are isolated from each other.
9. As a QuickStack user, I want the first sandbox of a brand-new tag to start with an empty volume, so that new tags need no setup.
10. As a QuickStack user, I want starting a sandbox without a Custom Tag to be rejected for an Agent with a `PER_CUSTOM_TAG` volume, with a clear message, so that data never has an undefined owner.
11. As a QuickStack user, I want a second start with a tag that is already running to be rejected, so that two sandboxes never write one workspace.
12. As a QuickStack user, I want to delete all stored data of one tag through a delete-tag operation, so that I can remove a user's data on request.
13. As a QuickStack user, I want deleting a tag's data to be rejected while a sandbox with that tag exists, so that a running sandbox cannot be raced.
14. As a QuickStack user, I want deleting an Agent Volume or an Agent to also delete its per-tag data, so that no storage leaks.
15. As a QuickStack user, I want an Agent with `ALL` and `PER_SANDBOX` only to behave exactly as before, so that existing Agents are unaffected.
16. As a QuickStack user, I want to mix `ALL` and `PER_CUSTOM_TAG` volumes on one Agent, so that I can combine shared and private data.
17. As a QuickStack user, I want `PER_SANDBOX` and `PER_CUSTOM_TAG` to be rejected together on one Agent, so that the two provisioning models never conflict.
18. As a QuickStack user, I want the filebrowser sidecar to show `PER_CUSTOM_TAG` volumes like other Agent Volumes, so that I can inspect them.
19. As an agent host, I want the start-sandbox API to require `customTag` for such Agents and return a clear validation error otherwise, so that I can integrate reliably.
20. As an agent host, I want the API to expose a delete-tag operation, so that I can honour deletion requests programmatically.
21. As a QuickStack operator, I want such sandboxes to cold-start with the tag PVC already attached, so that the agent never sees a half-prepared workspace.
22. As a QuickStack developer, I want the new fields surfaced through the shared Agent Volume model, so that frontend, REST API, and server agree.

## Implementation Decisions

### Domain

- New **Volume Type** `PER_CUSTOM_TAG` (**Per-Custom-Tag Agent Volume**); its durable copy is a per-tag PersistentVolumeClaim, not S3. No **Tag Data**, **Volume Restore**, or **Volume Upload** concepts.
- ADR 0013 records the decision and the rejected Variante 1 (S3 init/sidecar) and Variante 2 (SDK copy) alternatives. ADR 0011/0012 cross-reference it.

### Schema

- Agent Volume `volumeType` accepts `PER_CUSTOM_TAG` (stored as string; existing default `ALL`).
- No new column: the per-tag PVC is named from the Agent Volume and the tag; there is no S3 Target and no per-tag database record.
- Validation rule: an Agent may not combine `PER_SANDBOX` and `PER_CUSTOM_TAG`. Needs a Database Migration only if a constraint is enforced at the DB level; otherwise it is enforced at the service boundary.

### Shared models and validation

- Extend the Agent Volume edit/save models with the new type.
- Validation at the Agent Volume service boundary:
  - `PER_CUSTOM_TAG` accepts `ReadWriteOnce` and `ReadWriteMany`; `ALL` still requires `ReadWriteMany`.
  - Type, access mode, and storage class are immutable on update; size is changeable; mount paths stay unique per Agent.
  - Reject `PER_SANDBOX` + `PER_CUSTOM_TAG` on one Agent.
- Custom Tag validation stays as today (trimmed, 1–63 characters, case-sensitive, no character restrictions). The tag is encoded for the PVC name and never used raw in a Kubernetes name.

### Per-tag PVC management

- New naming util `toAgentTagPvcName(agentId, agentVolumeId, customTag)` reusing the `aw-` prefix so existing cleanup recognises it; labels/annotations `qs-agent-id`, `qs-agent-volume-id`, and `qs-custom-tag`.
- `ensureAgentTagPvc(projectId, agentVolume, customTag)` creates the claim if missing with the volume's access mode, storage class, and size.
- `deleteUnusedPvcForAgent` is fixed to retain `PER_CUSTOM_TAG` PVCs (never delete a `qs-custom-tag`-annotated claim on deploy). Per-tag PVCs are deleted only by the delete-tag operation or by Agent/Agent-Volume deletion.
- Size change: an existing tag PVC is expanded (grow-only) to the new size on the next start or deploy; new tags use the current size.

### Direct Sandbox construction (per start)

- A new per-start builder builds a `Sandbox` (not a claim):
  - static `volumes` for each `ALL` volume (existing shared claims) and each `PER_CUSTOM_TAG` volume (its per-tag claim, ensured first);
  - container mounts and filebrowser mounts at the configured paths;
  - the agent container with the Agent Runtime Secret and the tag-specific virtual-key Secret via `envFrom`/`env`;
  - `spec.service: true`, `spec.operatingMode: 'Running'`, `spec.shutdownTime` and `spec.shutdownPolicy: 'Delete'`, health probes, network policy and affinity as today.
- Deterministic Sandbox name `toAgentSandboxName(agentId, customTag)` (for example `as-<hash(agentId:tag)>`), so a second start with the same tag collides and lookups are cheap. Labels include `qs-agent-id` and `qs-custom-tag`.

### Adapter additions

- Base-Sandbox operations: `createSandbox`, `listSandboxes(namespace, selector)`, `deleteSandbox`, `waitForSandboxReady` (on Sandbox conditions), and a `resolveSandboxStatus(sandbox)` path. Read/patch already exist (`getSandbox`, `setSandboxOperatingMode`, `waitForSandboxSuspended`).

### Start orchestration

- `startSandbox` for an Agent with a `PER_CUSTOM_TAG` volume:
  - require a Custom Tag; reject with a validation error otherwise, before creating any resource;
  - enforce tag uniqueness and `PER_SANDBOX`/`PER_CUSTOM_TAG` exclusivity;
  - ensure the runtime secret and the tagged virtual key;
  - ensure the per-tag PVC for every `PER_CUSTOM_TAG` volume (grow if needed);
  - create the direct `Sandbox` (cold start, no warm pool) and wait for it to become ready.
- Stop, Suspend, Resume, list/get/exec, access URL and the SSE watch gain a direct-Sandbox branch; Agents without a `PER_CUSTOM_TAG` volume are unchanged.
- `stopSandbox` deletes the Sandbox and keeps the per-tag PVCs (and `ALL` claims); the tag becomes free.
- Suspend/Resume use `operatingMode`; the PVC is retained and reattached on Resume.

### Idle timeout

- At start, set `spec.shutdownTime = now + idleTimeoutMinutes` and `spec.shutdownPolicy: Delete`. On expiry the controller deletes the Sandbox, Pod, and Service; static PVCs are never touched. This is a fixed lifetime, not activity-based.

### Delete tag

- New REST operation `DELETE /api/v1/agents/:agentId/tags/:customTag`: deletes all data of that tag across the Agent's `PER_CUSTOM_TAG` volumes (the tag's PVCs) implicitly. Rejected with `409 Conflict` while a Sandbox with that tag exists. Idempotent; `204` on success.

### Volume / Agent deletion

- Deleting a `PER_CUSTOM_TAG` Agent Volume deletes its tag PVCs; deleting the Agent deletes all its Agent PVCs (as today via `deleteAllPvcForAgent`). The UI states this.

### Runtime scope

- Only Agents with at least one `PER_CUSTOM_TAG` volume use the direct-Sandbox path. The claim/template path for every other Agent stays byte-for-byte unchanged.

### Consistency notes

- At most one sandbox per tag exists (enforced by QuickStack), so `ReadWriteOnce` is valid.
- Data survives only while its PersistentVolume does: on node-bound `local-path` a lost node loses the data; a distributed storage class makes node loss survivable. No S3 fallback.
- These Agents cold-start and do not use the warm pool.
- Idle expiry is a fixed lifetime from start, not activity-based.
- `local-path` `ReadWriteOnce` claims may pin a resumed Pod to the original node.

### Seams selected for testing (confirmed)

1. Agent Volume service (integration, SQLite) — persistence, defaults, validation, immutability, `PER_SANDBOX`/`PER_CUSTOM_TAG` exclusivity.
2. Per-tag PVC management (unit/integration) — create-once/reuse, naming/annotations, deploy cleanup retention, grow-only resize.
3. Direct Sandbox builder (unit through a start test) — static PVC claimName and mounts for `ALL` and `PER_CUSTOM_TAG`, filebrowser, `envFrom`, `service`, `operatingMode`, `shutdownTime`/`shutdownPolicy`.
4. Agent Runtime service `startSandbox` (unit) — tag required, tag uniqueness, `ensureAgentTagPvc` before `createSandbox`, Stop keeps the PVC.
5. Delete tag — unit — conflict while a sandbox with the tag exists, otherwise deletes the tag's PVCs.

## Testing Decisions

A good test exercises externally observable behaviour: the persisted record, the built Kubernetes resource, or the call the service makes. No assertions on private helpers.

- **Agent Volume service — integration (SQLite), prior art: the Agent Volume integration suite.**
  - `PER_CUSTOM_TAG` persists with `ReadWriteOnce` and `ReadWriteMany`.
  - `PER_CUSTOM_TAG` combined with `PER_SANDBOX` is rejected.
  - On update, changing type, access mode, or storage class is rejected; changing size is accepted.
- **Per-tag PVC management — unit/integration.**
  - `ensureAgentTagPvc` creates once and reuses; naming/annotations carry the tag.
  - `deleteUnusedPvcForAgent` never deletes a `qs-custom-tag` PVC.
  - A size change expands an existing tag PVC.
- **Direct Sandbox builder — unit, prior art: the Agent service deploy/start suites.**
  - A `PER_CUSTOM_TAG` volume produces a static PVC volume and mount; `ALL` volumes are unchanged; filebrowser mounts both.
  - The tagged virtual-key Secret is referenced by the agent container; `spec.service`, `operatingMode: Running`, and `shutdownTime`/`shutdownPolicy` are set.
- **Agent Runtime `startSandbox` — unit, prior art: the Agent Runtime service suite.**
  - No tag with a `PER_CUSTOM_TAG` volume is rejected before any resource is created.
  - A tagged start calls `ensureAgentTagPvc` for each `PER_CUSTOM_TAG` volume, then creates a direct Sandbox (no claim); `stopSandbox` deletes the Sandbox but not the PVC.
  - Existing claim-path assertions for other Agents keep passing.
- **Delete tag — unit.** Rejected with a conflict while a sandbox with the tag exists; otherwise deletes the tag's PVCs and is idempotent.

## Out of Scope

- Any S3 involvement for `PER_CUSTOM_TAG` (Variante 1 and 2, rejected).
- Combining `PER_SANDBOX` with `PER_CUSTOM_TAG` on one Agent.
- Warm-pool adoption for these Agents.
- Activity-based idle detection (only a fixed lifetime from start is implemented).
- Migrating existing `PER_SANDBOX` data into `PER_CUSTOM_TAG` volumes.
- Changing `ALL` or `PER_SANDBOX` behaviour, or the claim template contract.

## Further Notes

- Builds on the current `feat/unify-project-workloads` branch: Volume Types `ALL`/`PER_SANDBOX` (ADR 0011), Suspend/Resume and unique Custom Tags (ADR 0012), tagged virtual keys.
- Controller facts verified (see `docs/agents/agent-sandbox-controller-research.md` and `docs/agents/agent-sandbox-shutdown-research.md`): a direct `Sandbox` carries a full PodSpec with static `volumes[].persistentVolumeClaim.claimName`; `spec.shutdownTime` + `shutdownPolicy: Delete` delete the Sandbox/Pod/Service and never touch static PVCs; `operatingMode` handles Suspend/Resume and rebinds the PVC; RBAC (`cluster-admin`) covers all verbs.
- The runtime fork is deliberate and bounded to Agents with a `PER_CUSTOM_TAG` volume; the claim path must not regress.
