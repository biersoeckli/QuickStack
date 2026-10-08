# Agent Volume Types

Status: ready-for-agent

## Problem Statement

Every **Agent Volume** in QuickStack is provisioned the same way: a single `ReadWriteMany` PersistentVolumeClaim per Agent Volume, created during **Deploy (Agent)** and statically referenced by the Agent's SandboxTemplate. Every Agent Sandbox instance of the Agent mounts that same claim, and the claim survives sandbox restarts and sandbox deletion.

This is correct for data that must be visible to all sandbox instances at once, but it is the only option available. A user who needs a private, per-sandbox workspace has no way to express it, and a user whose storage class does not offer `ReadWriteMany` cannot attach an Agent Volume at all. There is also no way to tell which sandbox owns which data when parallel sandboxes of the same Agent run.

## Solution

Let an **Agent Volume** declare its **Volume Type**:

- **ALL** — the existing behavior. A **Shared Agent Volume**: one `ReadWriteMany` PersistentVolumeClaim per Agent Volume, mounted by every Agent Sandbox instance of the Agent, surviving sandbox restarts and sandbox deletion.
- **PER_SANDBOX** — a **Per-Sandbox Agent Volume**: personal to each Agent Sandbox instance. The backing claim is provisioned from the Agent Volume's configuration when a sandbox starts, is deleted together with the sandbox, and may use `ReadWriteOnce` or `ReadWriteMany`.

The mechanism uses the Agent Sandbox controller's native `volumeClaimTemplates`:

1. The Agent's SandboxTemplate declares one claim template per PER_SANDBOX Agent Volume, using the Agent Volume's access mode, storage class, and size, and sets its volume-claim-templates policy to allow start-time overrides.
2. Starting a sandbox may carry an optional **Custom Tag**. When a tag is given, the start sends the matching claim templates on the SandboxClaim and records the tag as claim and claim-template metadata, so the tag lands on the per-sandbox claim. The Agent Sandbox controller cold-starts a Sandbox and creates a per-sandbox PersistentVolumeClaim that it owns and deletes with the Sandbox.
3. Starting a sandbox without a tag sends no claim templates, leaving the sandbox untagged; it still gets its own per-sandbox claim from the template.

Because each PER_SANDBOX sandbox owns its own claim, `ReadWriteOnce` is valid and no per-tag concurrency limit is required. ALL Agent Volumes are untouched and keep their shared, persistent claim.

## User Stories

1. As a QuickStack user, I want to mark an Agent Volume as `ALL`, so that every Agent Sandbox instance of the Agent mounts the same shared data.
2. As a QuickStack user, I want an `ALL` Agent Volume to require `ReadWriteMany`, so that the shared-claim contract is enforced instead of failing later at mount time.
3. As a QuickStack user, I want to mark an Agent Volume as `PER_SANDBOX`, so that each Agent Sandbox instance gets its own volume instead of sharing one.
4. As a QuickStack user, I want a `PER_SANDBOX` Agent Volume to allow `ReadWriteOnce`, so that I can attach storage classes that do not support `ReadWriteMany`.
5. As a QuickStack user, I want a `PER_SANDBOX` Agent Volume to also allow `ReadWriteMany`, so that I can pick shared-capable storage when I have it.
6. As a QuickStack user, I want to give an optional Custom Tag when I start an Agent Sandbox, so that I can identify a sandbox and its private volume by that tag.
7. As a QuickStack user, I want the Custom Tag recorded on the sandbox's PersistentVolumeClaim when I provide one, so that I can correlate a claim back to the sandbox that owns it.
8. As a QuickStack user, I want a sandbox started without a Custom Tag to simply have no tag, so that tagging stays optional.
9. As a QuickStack user, I want a `PER_SANDBOX` sandbox's claim to be deleted when the sandbox is deleted, so that private volumes do not leak.
10. As a QuickStack user, I want two untagged sandboxes of the same Agent to each get their own private volume, so that they never corrupt each other's data.
11. As a QuickStack user, I want two sandboxes with the same Custom Tag to each get their own private volume, so that reusing a tag does not force them to share storage.
12. As a QuickStack user, I want deploying an Agent after changing a `PER_SANDBOX` Agent Volume's size to affect newly started sandboxes, so that I can evolve the configuration without touching running sandboxes.
13. As a QuickStack user, I want an `ALL` Agent Volume's claim to keep surviving sandbox deletion, so that shared data is never lost by stopping a sandbox.
14. As a QuickStack user, I want `PER_SANDBOX` cold starts to be acceptable, so that per-sandbox volumes can be provisioned without a pre-warmed claim.
15. As a QuickStack user, I want an Agent whose only Agent Volumes are `ALL` to keep using its warm pool normally, so that existing Agents are unaffected.
16. As a QuickStack user, I want an Agent that has at least one `PER_SANDBOX` Agent Volume to still start successfully, so that mixing `ALL` and `PER_SANDBOX` volumes on one Agent works.
17. As a QuickStack user, I want to see an Agent Volume's type and access mode when I load an Agent, so that I can confirm its configuration.
18. As a QuickStack user, I want to create an Agent Volume without specifying a type, so that it defaults to `ALL` and existing behavior is preserved.
19. As a QuickStack user, I want to create an Agent Volume without specifying an access mode, so that it defaults to `ReadWriteMany`.
20. As a QuickStack user, I want the API to reject an `ALL` Agent Volume with a `ReadWriteOnce` access mode, so that I get a clear error instead of a broken deploy.
21. As a QuickStack user, I want an Agent Volume's volume type to be immutable after creation, so that existing claims are never silently reinterpreted.
22. As a QuickStack user, I want an Agent Volume's access mode to be immutable after creation, so that existing claims are never silently invalidated.
23. As a QuickStack user, I want an Agent Volume's storage class to remain immutable on update, so that existing claims are never silently invalidated.
24. As a QuickStack user, I want to change a `PER_SANDBOX` Agent Volume's size after creation, so that newly started sandboxes get the new size.
25. As a QuickStack user, I want removing a `PER_SANDBOX` Agent Volume to stop new sandboxes from getting it while leaving existing sandbox claims alone until their sandboxes are deleted, so that running sandboxes are not disrupted.
26. As a QuickStack user, I want removing an `ALL` Agent Volume to keep the existing cleanup of its shared claim, so that removed shared volumes do not leak.
27. As an agent host, I want the start-sandbox API to accept an optional Custom Tag, so that I can tag sandboxes and their private volumes programmatically.
28. As an agent host, I want the start-sandbox API's response to include the Custom Tag, so that I can map the started sandbox back to the tag I requested.
29. As a QuickStack user, I want a Custom Tag longer than the allowed length or empty after trimming to be rejected, so that bogus tags fail fast.
30. As a QuickStack operator, I want the Agent and its sandbox status to remain claim-based, so that stopping, listing, and entering sandboxes continue to work without a new resource type.
31. As a QuickStack operator, I want the Agent Sandbox template's claim policies to stay restrictive for Agents without `PER_SANDBOX` volumes, so that existing Agents keep their current security posture.
32. As a QuickStack developer, I want the new fields surfaced through the shared Agent Volume model, so that the frontend, REST API, and server all agree on the shape.

## Implementation Decisions

### Domain

- Introduce a **Volume Type** for **Agent Volume**: `ALL` (**Shared Agent Volume**) and `PER_SANDBOX` (**Per-Sandbox Agent Volume**). `ALL` is the default, preserving current behavior.
- A **Custom Tag** is the existing optional sandbox-level tag; it has no reserved values and is absent when not provided.
- Captured in `GLOSSARY.md` (Volume Type, Shared Agent Volume, Per-Sandbox Agent Volume, Custom Tag) and in `docs/adr/0011-per-sandbox-agent-volumes.md`.

### Schema

- Add `volumeType` to the Agent Volume, an enum stored as a string with default `ALL`.
- Add `accessMode` to the Agent Volume, an enum stored as a string with default `ReadWriteMany`. It accepts `ReadWriteMany` and `ReadWriteOnce`; it is only meaningful for `PER_SANDBOX`, and `ALL` must be `ReadWriteMany`.
- `volumeType` and `accessMode` are immutable after creation.
- Regenerate the Prisma-generated Zod models.

### Shared models and validation

- Extend the shared Agent Volume edit model with `volumeType` and `accessMode`.
- Validate at the Agent Volume service boundary:
  - `ALL` requires `ReadWriteMany`.
  - `PER_SANDBOX` accepts `ReadWriteOnce` or `ReadWriteMany`.
  - `volumeType`, `accessMode`, and `storageClassName` are immutable on update (existing rule extended).
  - `size` remains changeable.
  - Mount paths stay unique per Agent (existing rule).
- Tag validation: trim; an explicitly supplied tag that is empty after trimming is rejected; maximum length 63; case-sensitive; no character restrictions because the tag is never used to derive a Kubernetes object name. An absent tag stays absent.

### Agent Sandbox resource construction

- The Agent Sandbox template builder branches per Agent Volume on `volumeType`:
  - `ALL` → a static `volumes` entry whose `persistentVolumeClaim.claimName` points at the shared, QuickStack-managed claim; a matching container `volumeMount`. Unchanged from today.
  - `PER_SANDBOX` → a `volumeClaimTemplates` entry named after the Agent Volume, with `accessModes: [accessMode]`, the Agent Volume's `storageClassName`, and `resources.requests.storage` from `size`; a matching container `volumeMount`. No static volume is added for it.
- The template's volume-claim-templates policy is `Overrides` when the Agent has at least one `PER_SANDBOX` Agent Volume, and stays `Disallowed` otherwise.
- The Agent Sandbox claim builder gains an optional set of claim-template overrides and stamps each with metadata (the Custom Tag, when present, and the Agent Volume id).

### Start and stop orchestration

- Starting a sandbox accepts an optional Custom Tag. When a tag is given, the start adds one claim-template override per `PER_SANDBOX` Agent Volume, preserving the template's spec and adding the tag annotation to the claim template so the Agent Sandbox controller copies it onto the per-sandbox claim. Because a claim that carries claim templates bypasses the warm pool, this cold-starts the sandbox.
- Starting without a tag adds no overrides and records no tag; the warm pool (or a cold start) provisions the per-sandbox claim from the template's default claim templates.
- The Agent Runtime Secret, env injection, idle timeout, and readiness handling are unchanged.
- Stopping a sandbox still deletes the SandboxClaim; the Agent Sandbox controller deletes the Sandbox and its owned per-sandbox claim with it. QuickStack performs no extra claim cleanup for `PER_SANDBOX`.
- The list/get/exec paths stay claim-based and are unaffected.

### Shared-claim lifecycle

- Deploy-time claim creation only iterates `ALL` Agent Volumes.
- The unused-claim cleanup only considers QuickStack-owned shared claims. Per-sandbox claims created from claim templates are controller-owned and must not be touched by that cleanup.

### Consistency notes

- `ReadWriteOnce` is valid because each `PER_SANDBOX` sandbox owns its own claim, so there is no concurrent-mount conflict, and no one-sandbox-per-tag limit is needed.
- A `PER_SANDBOX` claim is not resized when the Agent Volume changes; only newly started sandboxes pick up new configuration.
- The Custom Tag is metadata only: it is never used to derive Kubernetes object names or to select which claim a sandbox uses.
- Providing a Custom Tag remains API-only; no start-sandbox UI is added.

### Seams selected for testing

Three existing seams are used, no new seam is introduced:

1. Agent Volume service — configuration persistence, defaults, and validation.
2. Agent Sandbox template builder (through the Agent deploy unit test) — template shape for both Volume Types.
3. Agent Runtime service `startSandbox` — claim-template overrides, tag stamping, and the untagged path.

## Testing Decisions

A good test exercises the externally observable contract of a module — the persisted record, the built Kubernetes resource, or the call the module makes — not its internal helper structure. Assertions target the resource body and the service results, matching the existing unit and integration style.

- **Agent Volume service — integration (SQLite), prior art: the Agent Volume integration suite.**
  - `ALL` with default type persists and defaults to `ReadWriteMany`.
  - `PER_SANDBOX` persists with `ReadWriteOnce` and with `ReadWriteMany`.
  - `ALL` combined with `ReadWriteOnce` is rejected.
  - An unknown `volumeType` or `accessMode` is rejected.
  - On update, changing `volumeType`, `accessMode`, or `storageClassName` is rejected.
  - On update, changing `size` is accepted.

- **Agent Sandbox template builder — unit through the Agent deploy test, prior art: the Agent service `deploy` suite that inspects the reconciled SandboxTemplate.**
  - An `ALL` volume produces a static `volumes` entry with the shared claim name and no claim template.
  - A `PER_SANDBOX` volume produces a `volumeClaimTemplates` entry with the configured access mode, storage class, and size, and a matching mount.
  - A mixed Agent produces both, and the policy is `Overrides`.
  - An Agent with no `PER_SANDBOX` volume keeps the policy `Disallowed`.

- **Agent Runtime service `startSandbox` — unit, prior art: the Agent Runtime service suite that inspects the built SandboxClaim.**
  - Starting with a Custom Tag adds one claim-template override per `PER_SANDBOX` volume, carrying the tag annotation; ALL volumes are never sent as overrides.
  - Starting without a tag sends no claim-template overrides and records no tag.
  - The existing secret, model-alias, idle-timeout, and readiness assertions keep passing.

## Out of Scope

- Persisting a `PER_SANDBOX` claim beyond the life of its sandbox, or reusing it across sandbox restarts after deletion.
- Sharing a single `PER_SANDBOX` claim across concurrent sandboxes with the same tag.
- A start-sandbox UI for entering a Custom Tag.
- Resizing existing per-sandbox claims when an Agent Volume's size changes.
- Changing the built-in env-injection or warm-pool policies beyond the volume-claim-templates policy.
- Backup, restore, and download flows for Agent Volumes.

## Further Notes

- Validated against Kubernetes Agent Sandbox `v1.0.5` (latest release, 2026-10-01) and `main`: `SandboxClaim.spec.volumeClaimTemplates` and `SandboxTemplate.spec.volumeClaimTemplatesPolicy` (`Disallowed` | `Allowed` | `Overrides`) are present, and the controller creates each claim as `<claim-template-name>-<sandbox-name>`, owned by the Sandbox, and copies the claim template's labels and annotations onto the PersistentVolumeClaim. A claim that carries claim templates bypasses the warm pool and cold-starts.
- Because the claim template name must match the container mount name, the Custom Tag is recorded as metadata only; it is not part of the generated claim name.
- The chosen `Overrides` policy lets the template carry default claim templates (so warm-pool sandboxes are valid) while a tagged start overrides them to stamp the tag.
- Implementation must keep `ALL` behavior byte-for-byte compatible with today for Agents that do not use `PER_SANDBOX`.
