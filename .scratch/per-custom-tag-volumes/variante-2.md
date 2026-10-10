# Per-Custom-Tag Agent Volumes — Variante 2 (QuickStack-orchestrated copy)

Status: draft
Variant: 2 (QuickStack copies data itself via the Kubernetes SDK; no init/sidecar in the sandbox Pod)
Branch: `feat/unify-project-workloads`

> Variante 2 replaces the in-Pod restore/upload containers of [Variante 1](./variante-1.md) with
> copy steps orchestrated by the QuickStack server, reusing the data path already used for
> volume backups (`cpFromPod` / `cpTarToPod` + `S3Service`). This document records the design
> as proposed and the feasibility gaps found in the code that must be solved for it to meet the
> user stories. See [Comparison](#comparison-with-variante-1).

## Problem Statement

Same as [Variante 1](./variante-1.md): an **Agent Volume** is either a **Shared Agent Volume** (`ALL`) or a **Per-Sandbox Agent Volume** (`PER_SANDBOX`), and none of them can give a **Custom Tag** a private workspace that survives Stop, deletion, idle expiry, or node loss. Variante 2 solves the same problem, but moves the durable copy in and out of S3 from the QuickStack server instead of from containers inside the sandbox Pod.

## Solution

Add the **Volume Type** `PER_CUSTOM_TAG` (a **Per-Custom-Tag Agent Volume**) as in Variante 1. The live data still sits on a per-sandbox PVC (native `volumeClaimTemplates`, `ReadWriteOnce` allowed), and the durable copy (**Tag Data**) still lives in an **S3 Target** under a prefix derived from the Agent Volume and the encoded Custom Tag. What differs is the data movement:

- **Start:** QuickStack creates the SandboxClaim, so the Sandbox and its per-sandbox PVC come up, **in parallel** QuickStack downloads the tag's Tag Data from S3 into its own pod, then copies it into the sandbox Pod over the Kubernetes SDK (`k8s.Exec` + `cpTarToPod`), and only then treats the sandbox as usable.
- **Stop (API/UI):** QuickStack first extracts the volume from the sandbox Pod into its own pod (`cpFromPod`, tar), uploads it to S3, and only then deletes the sandbox.
- Both directions reuse the existing helpers `standalonePodService.cpFromPod` (`src/server/services/standalone-services/standalone-pod.service.ts:137`), `cpTarToPod` (`:183`), `runCommandInPod` (`:74`) and `S3Service` (`src/server/services/aws-s3.service.ts`), exactly as `backup.service.ts:304-328` and `restore.service.ts:13-104` do today.
- No init container, no native sidecar, no lock object. The QuickStack server is the single mover.

## Feasibility Findings (from the code)

What already exists and supports the design:

- **Copy toolkit:** `cpFromPod` runs `tar zcf - <path>` inside the target container and streams to a file in the QuickStack pod; `cpTarToPod` pipes a local tar into `tar xfz - -C <path>` in the target container; both use `new k8s.Exec(...)` (`standalone-pod.service.ts:74-237`).
- **Precedent:** volume backup (`backup.service.ts:283-330`) and restore (`restore.service.ts:13-104`) already do cp + S3, including a temporary `alpine:3` pod that mounts a PVC.
- **Addressing the sandbox Pod:** `agent-sandbox.service.ts:94-138` resolves the Pod from `sandbox.status.selector` (phase Running) and the container named `agent`.
- **RBAC:** `qs-service-account` is bound to `cluster-admin` (`setup/setup.sh:166-184`), so `pods/exec`, pod create/delete and PVC access are available.

Gaps that block a clean implementation:

- **No pre-agent gate.** The agent container starts with the Pod; `waitForSandboxReady` only reports Ready afterwards. There is no "Pod running but agent held" hook, so the copy-in cannot be ordered before the agent runs.
- **No copy-out hook for controller-driven termination.** Idle expiry is driven by the claim's `ttlSecondsAfterFinished`; node loss and an already-SUSPENDED sandbox (PVC without a Pod) offer no place to run the copy.
- **Whole volume through QuickStack.** `cpFromPod` tars the entire directory; the S3 download loads the object fully into memory (`aws-s3.service.ts:48-62`). Large tag volumes risk QuickStack OOM and make QuickStack a bottleneck and single point of failure.
- **tar dependency.** Copy-in/out execs `tar` (and gzip) inside the agent container; arbitrary agent images may not have them. A helper pod avoids this but then cannot mount a `ReadWriteOnce`/`local-path` PVC concurrently with the sandbox.
- **No node affinity handling.** The restore helper pod is created without `nodeName`/affinity (`restore.service.ts:77-103`), so a `ReadWriteOnce` node-bound PVC cannot be reliably re-attached.

## Implementation Decisions

### Domain / Schema / Shared models / UI

Identical to Variante 1 except for the movement mechanism:

- New Volume Type `PER_CUSTOM_TAG` and the terms **Per-Custom-Tag Agent Volume**, **Tag Data** (no **Volume Restore** / **Volume Upload** containers in this variant; those steps are server-side operations).
- Agent Volume gains `s3TargetId` (required for `PER_CUSTOM_TAG`, forbidden otherwise, immutable). `volumeType`, `accessMode`, `storageClassName`, `s3TargetId` immutable; `size` mutable.
- Validation, tag rules, object layout `qs/agent-volumes/<agentVolumeId>/<base64url(tag)>/`, and tag encoding are the same. The server computes the full prefix.
- Agent Volume form gains `PER_CUSTOM_TAG` + required S3 Target select; the start Custom Tag input is required for such Agents.

### Agent Sandbox template construction

- Each `PER_CUSTOM_TAG` volume still produces a `volumeClaimTemplates` entry and a mount (and a filebrowser mount), policy `Overrides`, exactly like Variante 1.
- **No init container and no sidecar** are added. The agent container is the only container that mounts the tag volumes besides filebrowser.
- For a `ReadWriteOnce` sandbox volume, the QuickStack copy must reach the Pod/volume that the sandbox already has mounted. Two sub-options:
  - **2a (exec in the agent container):** copy in/out over `pods/exec` into the running sandbox. Requires `tar`/`gzip` in the agent image.
  - **2b (helper pod):** mount the PVC in a QuickStack-created helper pod. Only workable when the sandbox Pod does not hold the claim, and only with node-affinity handling.

### Start orchestration

1. `startSandbox` requires a Custom Tag for an Agent with a `PER_CUSTOM_TAG` volume.
2. Create the SandboxClaim with claim-template overrides (tag + Agent Volume id), as in Variante 1.
3. Wait for the Pod to be Running.
4. Meanwhile/afterwards, download the tag's Tag Data from S3 into the QuickStack pod.
5. Copy it into the sandbox volume via the SDK.
6. Mark the sandbox usable and return.

Problem: step 3 already starts the agent, and there is no supported way to hold it until step 5 finishes. A gate would have to be invented — for example a wrapper command that waits for a marker file, or a per-start pause/resume on the Sandbox — neither of which exists in the current template/claim contract.

### Stop orchestration

1. `stopSandbox` (API/UI) extracts the volume from the sandbox Pod to the QuickStack pod.
2. Uploads it to S3.
3. Deletes the SandboxClaim.

This makes Stop synchronous and long-running, and it still cannot run for idle expiry, node loss, or an already-suspended sandbox.

### Delete tag data

Same REST operation as Variante 1: `DELETE /api/v1/agents/:agentId/tag-data?customTag=[&volumeId=]`, conflict while a sandbox with the tag exists, idempotent, PVCs untouched. No lock is needed because CopyOut and Delete are serialized by QuickStack itself; only for API/UI Stop.

## Blockers / Open Gaps

These must be resolved (or explicitly accepted as lost behaviour) for Variante 2 to satisfy the user stories:

- **Agent starts before restore (breaks US 14).** Needs an invented hold/release gate; none exists. Without it the agent may read an empty or partially copied volume.
- **No copy-out on controller-driven end (breaks US 9 for idle expiry, node loss, suspend).** Needs a background reconciler that periodically or event-driven copies from suspended/orphaned PVCs — i.e. periodic sync plus helper pods, which Variante 1 deliberately avoids.
- **Crash between "stop requested" and "copy completed" loses the session** (US 8/12) because there is no durable in-Pod upload.
- **QuickStack as data path:** full volume through the server, in-memory S3 download, API-call duration tied to data size, retry/partial-failure handling for large volumes.
- **tar/gzip in the agent image**, or the helper-pod scheduling problem for `ReadWriteOnce`/`local-path`.
- **Suspend semantics:** if Suspend must refresh S3, Variante 2 has to copy out before `operatingMode: Suspended`, and copy in again on Resume (the PVC is retained, so usually a no-op, but the mechanism differs from Variante 1's marker skip).

## User Stories (delta vs. Variante 1)

All Variante 1 stories apply, with these deltas:

- US 12 (upload on Suspend): only if QuickStack copies out synchronously before patching `operatingMode`; not covered for a Suspend initiated outside QuickStack.
- US 13 (upload after agent stopped): replaced by "Stop is synchronous and copy-out runs before deletion".
- US 14 (restore before agent starts): **not satisfiable** without an invented gate.
- US 15 (wait for previous upload): replaced by serializing CopyOut and Delete in QuickStack; only for API/UI Stop.
- US 16 (fail on restore/upload error): QuickStack returns the error directly instead of inspecting an init container.
- US 19 (upload failure never blocks deletion): decision — choose whether a failed CopyOut aborts the deletion (data loss) or deletes anyway (the user story says it must not block).
- US 27 (credentials only to restore/upload containers): credentials never enter the sandbox at all; QuickStack uses them in its own process.

## Testing Decisions

- **Agent Volume service / start / template:** same as Variante 1 minus the init/sidecar and secret assertions.
- **Copy orchestration (new seam):** unit/integration tests for the server-side CopyIn/CopyOut flow against a fake object store and a stubbed exec surface: start with/without tag, Stop uploads then deletes, Stop when CopyOut fails (assert chosen behaviour), no-tag rejection. Prior art: `backup.service.ts` / `restore.service.ts` tests if present.
- **Boundary/error tests:** agent image without `tar`, QuickStack disk/memory limits, interrupted copy, node-bound `ReadWriteOnce` helper scheduling.

## Out of Scope

Same as Variante 1, plus explicitly:

- An in-Pod restore/upload container (that is Variante 1).
- A per-start hold/release gate on the agent container.
- A background reconciler that copies from suspended or orphaned PVCs.

## Comparison with Variante 1

| Aspect | Variante 1 (init + native sidecar) | Variante 2 (QuickStack copies via SDK) |
|---|---|---|
| Where data moves | Inside the sandbox Pod by QuickStack-maintained containers | Through the QuickStack server and `pods/exec` |
| Restore before agent | Guaranteed by init container ordering | No gate exists; agent may start first (US 14 unmet) |
| Trigger coverage | Every Pod termination: Stop, Suspend, idle expiry, redeploy, node drain | Only API/UI Stop and Suspend before the Pod is gone |
| Node loss / idle expiry | Covered by sidecar upload before Pod ends | Not covered without a background reconciler |
| Idle timeout | Sidecar uploads as the Pod is deleted | No hook; last S3 copy is stale |
| Race Stop↔next start | Timestamped lock marker, bounded wait, fail-closed | Serialized in QuickStack; no lock needed for API Stop |
| Failure visibility | Upload errors in sandbox pod logs; restore failure inspected by QuickStack | Errors surfaced directly by the QuickStack call |
| Credentials in sandbox | S3 creds in a Secret mounted only by restore/upload | S3 creds never enter the sandbox |
| New image | Yes: `quickstack/agent-volume-sync` (restore/upload) | No new image; reuses `cpFromPod`/`cpTarToPod` + S3 |
| Dependencies in agent image | None (sidecar has its own image) | Needs `tar`/`gzip` in the agent image, or a helper pod |
| QuickStack load | None during steady state; only control plane | All tag data flows through QuickStack; OOM/disk/SPOF risk |
| API latency | Start waits only for readiness; Stop is async | Stop and Start block for the whole copy |
| Complexity | New image, Secret, init/sidecar, marker, lock, staleness, grace | Reuses existing helpers; but needs a gate + reconciler to be correct |
| RWO/local-path | No extra scheduling problem (same Pod) | Helper pod on a node-bound PVC has no node affinity handling |
| Correctness of US 9/12/14 | Meets them | Only partially; requires extra machinery or accepted data loss |
| Implementation effort | Higher up front, self-contained, bounded | Lower first cut, but grows toward a reconciler + gate to be correct |
| Fits existing patterns | New `additional-containers` image + template builder changes | Fits the existing backup/restore data path exactly |
