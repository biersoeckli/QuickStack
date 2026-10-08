# Suspend and Resume Agent Sandboxes via the Sandbox operatingMode

QuickStack lets a user **Suspend** a running **Agent Sandbox** and later **Resume** it. Suspend releases the sandbox's compute (its Pod, CPU, and memory) while keeping the Sandbox object, its Service, and its per-sandbox PersistentVolumeClaims. Resume recreates the Pod with the same claims mounted. Stop keeps its existing meaning: delete the SandboxClaim and everything it owns, including per-sandbox data.

Suspend and resume act on the Sandbox, not the SandboxClaim. The Agent Sandbox controller exposes the native `Sandbox.spec.operatingMode` (`Running` | `Suspended`); the SandboxClaim has no equivalent field, so QuickStack resolves the Sandbox behind a claim (the claim status records the Sandbox name, which differs from the claim name for warm-pool-adopted sandboxes) and patches `operatingMode` there directly. No new Kubernetes resource types and no RBAC beyond updating Sandboxes are needed.

A **Suspended Sandbox** is the only way a **Per-Sandbox Agent Volume** outlives a sandbox. This refines ADR 0011: "tag-scoped data does not survive sandbox deletion" still holds, but it does survive suspension.

A **Custom Tag** becomes a stable handle: it is unique per Agent among existing sandboxes, so resume-by-tag is unambiguous. Uniqueness is a best-effort check at start time; a lost race is acceptable because starts are low-contention and API-only. Stopping a sandbox frees its tag for reuse. Untagged sandboxes are unaffected.

## Considered Options

- **Patch the SandboxClaim.** Rejected: the claim has no lifecycle field for suspension, and deleting the claim (the only lever it offers) deletes the per-sandbox claims and data.
- **Create a Sandbox directly per suspend request.** Rejected: it would fork the claim-based status, stop, and exec paths, and lose warm-pool adoption.
- **Add QuickStack-owned persistence for suspend state.** Rejected: the controller already persists `operatingMode` on the Sandbox, so extra state would drift.

## Consequences

- Sandbox status gains `SUSPENDED`, resolved from the Sandbox `operatingMode` or the claim's forwarded `SandboxSuspended` Ready reason.
- Exec, file, and access-URL operations against a Suspended Sandbox fail with a dedicated "sandbox is suspended" error instead of a pod-not-found error.
- Resume uses the template snapshot the Sandbox was created with; redeploying an Agent never alters a Suspended Sandbox, and volume size changes only affect newly started sandboxes.
- Resume latency depends on the storage class, because the Pod re-attaches its volumes; `ReadWriteOnce` volumes may pin the resumed Pod to the original node.
- Automatic idle suspension and retention-based deletion of Suspended Sandboxes are not implemented yet; a suspended sandbox is kept until it is resumed or stopped.
