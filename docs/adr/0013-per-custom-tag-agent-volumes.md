# Per-Custom-Tag agent volumes are stable PVCs on directly created Sandboxes

A new **Volume Type** `PER_CUSTOM_TAG` gives an **Agent Volume** data that belongs to a **Custom Tag** instead of to a sandbox. The durable data is a QuickStack-managed PersistentVolumeClaim per (Agent Volume, Custom Tag), not an S3 copy. An Agent that has such a volume is started by QuickStack creating a `Sandbox` object directly (`agents.x-k8s.io/v1beta1`) instead of a `SandboxClaim` from a `SandboxTemplate`: before the Sandbox is created QuickStack ensures the per-tag PVC exists and attaches it through a static `podTemplate.spec.volumes[].persistentVolumeClaim.claimName`. Stop, deletion, and idle expiry delete the Sandbox and its Pod but never the PVC, so a tag keeps its workspace. Idle expiry uses `spec.shutdownTime` with `spec.shutdownPolicy: Delete`. `PER_SANDBOX` and `PER_CUSTOM_TAG` are mutually exclusive on one Agent; `ALL` may be mixed.

## Considered Options

- **S3 restore/upload around a per-sandbox PVC via an init container and a native sidecar.** Rejected: it adds a maintained image, a Secret, completion-marker and lock machinery and an S3 dependency when in-cluster storage already persists the data.
- **QuickStack copying data in and out through the Kubernetes SDK.** Rejected: there is no gate before the agent container starts, and no copy-out hook for controller-driven terminations (idle expiry, node loss, an already-suspended sandbox).
- **Keeping the claim/template model and attaching a tag-owned PVC.** Rejected: native `volumeClaimTemplates` always produce per-sandbox claims owned and deleted by the Sandbox, so a stable claim selected at start is not expressible.

## Consequences

- No S3 Target and no per-tag database record: the PVC, named from the Agent Volume and the encoded tag, is the durable copy.
- Data survives only while its PersistentVolume does. On a node-bound storage class such as `local-path` a lost node loses the data; a distributed storage class (for example Longhorn) makes node loss survivable.
- These Agents fork off the claim path: create, list, delete, ready-wait, status, exec, access URL and the SSE watch gain a direct-`Sandbox` branch. Agents without `PER_CUSTOM_TAG` are untouched.
- No warm pool for these Agents; every start is a cold start.
- Idle expiry is a fixed lifetime from start (`shutdownTime`), not activity-based.
- Tag uniqueness is enforced by QuickStack against the existing Sandboxes and the deterministic Sandbox name.
- Deleting an Agent Volume or an Agent deletes its per-tag PVCs; one tag's data is removed through the delete-tag operation.
- `ReadWriteOnce` is valid because at most one sandbox per tag exists; a retained `local-path` claim may pin a resumed Pod to the original node.
