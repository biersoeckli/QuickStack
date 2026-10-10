# Per-Custom-Tag Agent Volumes — Variante 1

Status: draft
Variant: 1 (further variants to be discussed)
Branch: `feat/unify-project-workloads`

> This is the refined statement of Variante 1 after the grilling session. Decisions marked
> **(confirmed)** were agreed; the section [Open / Proposed](#open--proposed) lists items that
> were recommended but not yet confirmed, so other variants can be compared against them.

## Problem Statement

An **Agent Volume** is either a **Shared Agent Volume** (`ALL`) or a **Per-Sandbox Agent Volume** (`PER_SANDBOX`). A Per-Sandbox Agent Volume is deleted with its sandbox (ADR 0011). **Suspend** keeps it only while the sandbox exists (ADR 0012). A Shared Agent Volume is visible to every sandbox of the Agent, so it cannot give each user, session, or customer a private workspace that comes back later.

A user who runs one sandbox per end user (identified by the **Custom Tag**) therefore has no way to say "this tag always gets its own workspace, and that workspace is still there after the sandbox was stopped, deleted, expired, or lost with its node". Today the data is gone after Stop or after the idle timeout.

## Solution

Add a third **Volume Type**, `PER_CUSTOM_TAG`: a **Per-Custom-Tag Agent Volume**. Its data belongs to a **Custom Tag**, not to a sandbox.

- While a sandbox exists, the live data sits on a per-sandbox PersistentVolumeClaim, exactly like `PER_SANDBOX` (native `volumeClaimTemplates`, `ReadWriteOnce` allowed). That claim stays the source of truth while the sandbox exists and survives Suspend and Resume.
- The durable copy is **Tag Data**: it lives in S3-compatible object storage, in an **S3 Target** the Agent Volume references, under a prefix derived from the Agent Volume and an encoded form of the Custom Tag.
- **Volume Restore:** an init container runs before the agent container and, only when the volume is not yet marked restored, restores the tag's data from S3.
- **Volume Upload:** a native sidecar mirrors the volume to S3 when the Pod shuts down (Stop, Suspend, idle expiry, Agent redeploy, Node drain). A native sidecar is stopped after the agent container, so the upload sees the final state.
- There is no periodic sync: while the sandbox exists the PVC is the safety net. S3 is only the copy that outlives the sandbox.
- Because the Custom Tag is unique per Agent among existing sandboxes (ADR 0012), at most one sandbox writes a tag's data at a time.
- A sandbox for an Agent that has a `PER_CUSTOM_TAG` volume must be started with a Custom Tag.

Captured by ADR 0013 and the new **GLOSSARY.md** terms **Per-Custom-Tag Agent Volume**, **Tag Data**, **Volume Restore**, **Volume Upload**.

## User Stories

1. As a QuickStack user, I want to mark an Agent Volume as `PER_CUSTOM_TAG`, so that its data belongs to a Custom Tag instead of a sandbox.
2. As a QuickStack user, I want to pick the S3 Target that stores a `PER_CUSTOM_TAG` volume's data, so that I control where the durable copy lives.
3. As a QuickStack user, I want the S3 Target to be required for a `PER_CUSTOM_TAG` volume and rejected for other types, so that a misconfigured volume fails when saved, not at runtime.
4. As a QuickStack user, I want a `PER_CUSTOM_TAG` volume to allow `ReadWriteOnce`, so that storage classes without `ReadWriteMany` work.
5. As a QuickStack user, I want the volume type, access mode, storage class, and S3 Target of an existing Agent Volume to be immutable, so that existing data is never silently reinterpreted.
6. As a QuickStack user, I want to change the size of a `PER_CUSTOM_TAG` volume, so that newly started sandboxes use the new size.
7. As a QuickStack user, I want a sandbox started with Custom Tag `alice` to have its own writable volume at the configured mount path, so that the agent can work normally.
8. As a QuickStack user, I want data that the agent wrote under tag `alice` to be restored when I stop the sandbox and later start a new sandbox with tag `alice`, so that the workspace persists across sessions.
9. As a QuickStack user, I want the restore to also work after the sandbox was deleted by the idle timeout or after the node was lost, so that persistence does not depend on the original PVC.
10. As a QuickStack user, I want tag `bob` to never see tag `alice`'s data, so that tags are isolated from each other.
11. As a QuickStack user, I want the restore to run only when the volume was not already restored, so that resuming a Suspended Sandbox never overwrites newer data on its PVC with an older S3 copy.
12. As a QuickStack user, I want a Suspended Sandbox to upload its volume to S3 when it suspends, so that the durable copy is current even if the sandbox is deleted later.
13. As a QuickStack user, I want the upload to start only after the agent container has stopped, so that the snapshot is consistent.
14. As a QuickStack user, I want the sandbox to wait for the Volume Restore before the agent container starts, so that the agent never sees a half-restored workspace.
15. As a QuickStack user, I want starting a sandbox whose tag's previous upload is still in progress to wait for it, so that I never restore partial data.
16. As a QuickStack user, I want a start to fail with a clear error when the restore fails or the previous upload does not finish in time, so that I do not work on stale or partial data unnoticed.
17. As a QuickStack user, I want the first sandbox of a brand-new tag to start with an empty volume, so that new tags need no setup.
18. As a QuickStack user, I want starting a sandbox without a Custom Tag to be rejected for an Agent with a `PER_CUSTOM_TAG` volume, with a clear message, so that data never has an undefined owner.
19. As a QuickStack user, I want an upload failure never to block sandbox deletion, so that a broken S3 Target cannot trap a stuck sandbox.
20. As a QuickStack user, I want an upload failure to be visible in the sandbox's logs, so that I can diagnose missing data.
21. As a QuickStack user, I want an Agent with `ALL` and `PER_SANDBOX` volumes only to behave exactly as before, so that existing Agents are unaffected.
22. As a QuickStack user, I want to mix `ALL`, `PER_SANDBOX`, and `PER_CUSTOM_TAG` volumes on one Agent, so that I can combine shared and private data.
23. As a QuickStack user, I want to delete the stored data of one tag for a `PER_CUSTOM_TAG` volume, so that I can remove a user's data on request.
24. As a QuickStack user, I want deleting a tag's stored data to be rejected while a sandbox with that tag exists, so that a running sandbox cannot be raced.
25. As a QuickStack user, I want deleting an Agent Volume to leave its S3 data untouched and to say so, so that no external data is deleted by accident.
26. As a QuickStack user, I want an S3 Target that is referenced by an Agent Volume to be protected from deletion, so that I cannot orphan persisted data.
27. As a QuickStack user, I want the S3 credentials to be available only to the restore and upload containers and not to the agent container, so that agent code cannot read or delete the bucket.
28. As a QuickStack user, I want the filebrowser sidecar to show `PER_CUSTOM_TAG` volumes like other Agent Volumes, so that I can inspect them.
29. As an agent host, I want the start-sandbox API to require `customTag` for such Agents and return a clear validation error otherwise, so that I can integrate reliably.
30. As an agent host, I want the API to expose a delete-tag-data operation, so that I can honour deletion requests programmatically.
31. As a QuickStack user, I want stored tag data to be grouped by Agent Volume and by an encoded form of the tag, so that any tag value, including special characters, is a valid object prefix.
32. As a QuickStack operator, I want sandboxes of such Agents to cold-start, so that restore always runs on a fresh Pod with the tag known.
33. As a QuickStack developer, I want the new fields surfaced through the shared Agent Volume model, so that frontend, REST API, and server agree.

## Implementation Decisions

### Domain

- New **Volume Type** `PER_CUSTOM_TAG` (**Per-Custom-Tag Agent Volume**). New terms for `GLOSSARY.md`: **Per-Custom-Tag Agent Volume**, **Volume Restore**, **Volume Upload**, **Tag Data**. The existing "Avoid: per-tag volume" on **Per-Sandbox Agent Volume** is reconciled: the new term is "Per-Custom-Tag", not "per-tag". **(confirmed)**
- New ADR 0013: durable tag data through S3 restore/upload around a per-sandbox PVC. It refines ADR 0011 (a start by Custom Tag no longer implies loss on deletion for this type) and complements ADR 0012 (Suspend keeps the PVC; S3 covers deletion). **(confirmed, written)**
- Considered and rejected (recorded in the ADR): tag-owned PVC attached at start (not expressible with native `volumeClaimTemplates`), `emptyDir` plus S3 only (loses data on any Pod loss and makes Suspend depend on the upload), periodic sync (PVC already covers crashes while the sandbox exists).

### Schema

- Agent Volume `volumeType` accepts `PER_CUSTOM_TAG` (stored as string; existing default `ALL`).
- Agent Volume gains an optional `s3TargetId` reference to an S3 Target. Required for `PER_CUSTOM_TAG`, forbidden otherwise, immutable after creation. The relation uses `onDelete: Restrict` so a referenced target cannot be deleted. Needs a Database Migration and regenerated Prisma-generated Zod models.
- No database record per tag: Tag Data lives only in S3.

### Shared models and validation

- Extend the Agent Volume edit/save models with the new type and the S3 Target id.
- Validation at the Agent Volume service boundary:
  - `PER_CUSTOM_TAG` requires an existing S3 Target; accepts `ReadWriteOnce` and `ReadWriteMany`.
  - `ALL` still requires `ReadWriteMany`; S3 Target rejected for `ALL` and `PER_SANDBOX`.
  - Type, access mode, storage class, and S3 Target are immutable on update; size is changeable; mount paths stay unique per Agent.
- Custom Tag validation stays as today (trimmed, 1–63 characters, case-sensitive, no character restrictions). The tag is encoded for the S3 prefix and never used raw in Kubernetes names or object keys.

### Object layout and tag encoding

- Base prefix per Agent Volume: `qs/agent-volumes/<agentVolumeId>/`; full prefix adds `base64url(utf8(tag))`: `qs/agent-volumes/<agentVolumeId>/<base64url(tag)>/`.
- The **server** computes the full prefix (base + encoded tag) and passes per-volume `{localPath, target, prefix}` to the sync containers; the shell runner performs no encoding. **(confirmed)**
- Lock object: `<prefix>/.quickstack-lock`, content `{"startedAt":"<ISO>"}`. Restore completion marker: `<volumeRoot>/.quickstack/restored`. The marker is mirrored to S3 like any file (harmless). **(confirmed)**

### Agent Sandbox template construction

- Each `PER_CUSTOM_TAG` volume produces a `volumeClaimTemplates` entry (access mode, storage class, size), a mount at its configured path in the agent container, and (if enabled) a filebrowser mount, exactly like `PER_SANDBOX`. The template's volume-claim-templates policy is `Overrides` if the Agent has any `PER_SANDBOX` or `PER_CUSTOM_TAG` volume.
- If the Agent has at least one `PER_CUSTOM_TAG` volume, the Pod template additionally contains:
  - an **init container** named `volume-restore` that mounts those volumes;
  - a **native sidecar** (an init container with restart policy `Always`) named `volume-upload` that mounts the same volumes and uploads on termination.
- Both containers run one QuickStack-maintained image: a new `additional-containers/agent-volume-sync` Alpine image with `aws-cli` installed at build time, `restore.sh` / `upload.sh`, `Dockerfile.amd64` + `Dockerfile.arm64`, built by `build-release.yml` and `canary-release.yml`, pushed as `quickstack/agent-volume-sync:<tag>` with the backup tag expression (`canary` / `latest`). **(confirmed)**
- S3 Target settings are delivered through a Secret created and owned by QuickStack **per Agent**, carrying a JSON map `volumeId -> {target fields, prefix, localPath}` because one Agent may reference several targets. It is mounted only by `volume-restore` and `volume-upload` (static `env` with `valueFrom.secretKeyRef`), never by the agent or filebrowser container. The Secret is re-upserted on every sandbox start, so credential rotation needs no redeploy. **(confirmed)**
- The Custom Tag reaches both containers through the claim `env` with `containerName` set to `volume-restore` and `volume-upload`; this is verified to reach init containers and native sidecars. **(confirmed)**
- The Pod template sets `terminationGracePeriodSeconds: 300` (platform default, no per-Agent setting). The SandboxWarmPool of such Agents is reconciled with `replicas: 0` (see Open / Proposed).
- The sync tool contract:
  - **Restore:** if `<volumeRoot>/.quickstack/restored` exists, skip. Otherwise, if `<prefix>/.quickstack-lock` exists and is fresh (< 600 s), wait (poll 5 s) for it to clear; on timeout fail the init container. If the lock is stale, steal it. Then remove all volume entries except `lost+found`, download the prefix into the volume (no-op if the prefix does not exist), and write the marker. Any failure fails the init container.
  - **Upload:** on SIGTERM, write `<prefix>/.quickstack-lock` with `startedAt`, mirror the volume to the prefix including deletions (`aws s3 sync --delete`), then remove the lock. Errors are logged; the process exits 0 so Pod deletion is never blocked.
  - The image honors the target's `forcePathStyle` and `v4Auth` via `AWS_CONFIG_FILE` (same approach as `additional-containers/postgres-backup/backup.sh`).

### Start orchestration

- `startSandbox`:
  - For an Agent with at least one `PER_CUSTOM_TAG` volume and no Custom Tag, reject with a validation error before creating any resource.
  - With a tag, the claim carries one claim-template override per `PER_SANDBOX` and `PER_CUSTOM_TAG` volume, stamped with tag and Agent Volume id annotations (existing behaviour extended to the new type), so the start cold-starts and bypasses the warm pool.
  - The tag is passed to the restore and upload containers through claim `env` with `containerName`.
  - Existing tag-uniqueness check, tagged virtual key, secret, idle timeout and readiness handling stay.
  - The readiness wait uses a longer default timeout (600_000 ms) for Agents with `PER_CUSTOM_TAG` volumes (platform default, not a new setting). On timeout, `startSandbox` best-effort inspects the sandbox pod's init container and fails with a dedicated "Volume Restore failed" error instead of a generic timeout (see Open / Proposed).
- Stop, Suspend, Resume, list/get/exec paths are unchanged. Suspend triggers the same Pod termination and therefore the upload; Resume skips restore because the marker is present. Stop does not wait for the upload; the lock covers the race. **(confirmed)**
- A sandbox for an Agent with a `PER_CUSTOM_TAG` volume is required to carry a tag; tagged starts cold-start.

### Delete tag data

- New operation (service + REST): `DELETE /api/v1/agents/:agentId/tag-data?customTag=<tag>[&volumeId=<id>]`. `customTag` is required; omitting `volumeId` deletes the tag across all `PER_CUSTOM_TAG` volumes of the Agent.
- Rejected with `409 Conflict` if a sandbox with that tag exists, or if a fresh `<prefix>/.quickstack-lock` is present (upload in progress). Idempotent when no data exists. Does not touch PVCs.
- Across several volumes/targets, successful prefixes are deleted and failures are collected and returned; retry is idempotent (see Open / Proposed).
- Deleting an Agent Volume or an Agent leaves Tag Data in S3; the ADR and UI text state this.

### UI

- Agent Volume form: the type select gains `PER_CUSTOM_TAG`; selecting it shows a required S3 Target select (existing S3 Targets) and allows `ReadWriteOnce`. Existing edit rules (immutable fields) apply.
- The start-sandbox Custom Tag input is required for Agents with a `PER_CUSTOM_TAG` volume.
- No UI for browsing Tag Data in this iteration.

### Consistency notes

- While a sandbox exists the PVC wins; S3 only seeds a volume that was not restored. S3 may lag behind the PVC until the next shutdown.
- A crash that skips the upload (SIGKILL after the grace period, node loss) loses writes since the last successful upload only if the PVC is also lost.
- Credentials in the upload container are the S3 Target's credentials and are not scoped to a prefix; operators should use a dedicated bucket. Per-prefix scoped credentials are out of scope.
- Native sidecars require Kubernetes 1.29+ (default-on). The pinned K3s versions (`v1.31.3+k3s1` prod, `v1.33.4` canary) satisfy this.

### Seams selected for testing (confirmed)

1. Agent Volume service (integration, SQLite) — persistence, defaults, validation, immutability, S3 Target rules.
2. Agent Sandbox template builder via the Agent deploy test — template shape for all three volume types.
3. Agent Runtime service `startSandbox` — tag required, claim-template overrides for both per-sandbox types, tag env, warm pool bypass.
4. Volume Sync Runner — integration against a local S3 (MinIO) in CI: restore empty / non-empty, lock wait, stale steal, `sync --delete`, store error → exit 0. Prefix and Secret composition stay TypeScript and are unit-tested in Vitest.

## Testing Decisions

A good test exercises externally observable behaviour: the persisted record, the built Kubernetes resource, the claim sent to the adapter, or the objects present in the fake/local store. No assertions on private helpers.

- **Agent Volume service — integration (SQLite), prior art: the Agent Volume integration suite.**
  - `PER_CUSTOM_TAG` persists with an S3 Target, with `ReadWriteOnce` and `ReadWriteMany`.
  - `PER_CUSTOM_TAG` without an S3 Target is rejected; `ALL`/`PER_SANDBOX` with an S3 Target is rejected; an unknown S3 Target is rejected.
  - On update, changing type, access mode, storage class, or S3 Target is rejected; changing size is accepted.
  - A referenced S3 Target cannot be deleted.
- **Template builder through Agent deploy test — unit, prior art: the Agent service deploy suite.**
  - A `PER_CUSTOM_TAG` volume produces a claim template and a mount, an init container and a native sidecar mounting it, and policy `Overrides`.
  - The S3 Secret is referenced only by the init container and sidecar, not by the agent or filebrowser container.
  - An Agent without `PER_CUSTOM_TAG` volumes has no init container or sidecar; `ALL`/`PER_SANDBOX`-only output is unchanged.
  - A mixed Agent produces all expected entries.
- **Agent Runtime service `startSandbox` — unit, prior art: the Agent Runtime service suite.**
  - No tag with a `PER_CUSTOM_TAG` volume is rejected before any resource is created.
  - With a tag, claim-template overrides are sent for `PER_SANDBOX` and `PER_CUSTOM_TAG` volumes only, and the tag is passed in the claim environment targeted at `volume-restore`/`volume-upload`.
  - Existing assertions (duplicate tag conflict, tagged virtual key, readiness) keep passing.
- **Delete tag data — unit.** Rejected with a conflict while a sandbox with that tag exists or a fresh lock is present; otherwise deletes only the prefix of that Agent Volume and tag.
- **Volume Sync Runner — integration with local S3 and temp directory.**
  - Restore into a volume without a marker downloads the tag's objects and writes the marker; with the marker present does nothing; with no prefix writes the marker only.
  - Restore waits for a fresh lock and fails after the timeout without restoring; steals a stale lock.
  - Upload writes the lock marker, mirrors files (including deletions), and removes the marker; on a store error it logs and still exits normally.
  - Tag `alice` and tag `bob` (and a tag with special characters) never share a prefix.

## Open / Proposed

Recommended during the session but not yet confirmed; other variants may diverge here.

- **Q20 WarmPool:** reconcile `SandboxWarmPool` with `replicas: 0` for Agents with a `PER_CUSTOM_TAG` volume (rather than deleting the resource).
- **Q21 AgentTemplate:** Agent Templates may carry `volumeType` + `s3TargetId` with the same validation.
- **Q22 Sync test seam:** shell runner is integration-tested against local MinIO (no TS runner reintroduced).
- **Q23 Prefix computation:** server-side full-prefix computation (already reflected above).
- **Q24 Restore error surfacing:** detect init-container failure on readiness timeout and raise a dedicated "Volume Restore failed" error (already reflected above).
- **Q25 delete-tag-data partial failures:** delete what succeeds, aggregate failures (already reflected above).
- **Q26 marker/lock names:** `<prefix>/.quickstack-lock` and `<volumeRoot>/.quickstack/restored` (already reflected above).

## Out of Scope

- Periodic or continuous sync to S3.
- Scoped (per-prefix) or short-lived S3 credentials.
- Sharing one tag's data between concurrently running sandboxes.
- A UI for browsing, exporting, or restoring Tag Data, and S3 lifecycle/retention rules.
- Per-Agent configuration of grace period, restore/upload filters, or size limits.
- Automatic idle suspension and retention (ADR 0012 follow-ups).
- Changing `ALL` or `PER_SANDBOX` behaviour.
- Migrating existing `PER_SANDBOX` data into `PER_CUSTOM_TAG` volumes.

## Further Notes

- Builds on the current `feat/unify-project-workloads` branch: Volume Types `ALL`/`PER_SANDBOX` (ADR 0011), Suspend/Resume and unique Custom Tags (ADR 0012), tagged virtual keys, and existing S3 Targets.
- Controller verification done (see `docs/agents/agent-sandbox-controller-research.md`): (1) claim `env` reaches init containers and native sidecars via `containerName`; (2) a Pod template with init containers and native sidecars is accepted, copied and honored; (3) claim deletion, Suspend, and Pod eviction all honour the grace period and run native sidecars after regular containers.
- Race to cover: Stop deletes the claim and frees the tag immediately, while the old Pod may still be uploading. The lock marker makes the next start wait; this is why the restore has a bounded wait and fails closed.
- Restore time grows with data size and extends cold start; large workspaces should be kept off the volume or the readiness timeout raised.
- `local-path` PVCs are node-bound; on `ReadWriteOnce` a resumed Pod may be pinned to the original node. Tag Data in S3 is what survives losing that node.
