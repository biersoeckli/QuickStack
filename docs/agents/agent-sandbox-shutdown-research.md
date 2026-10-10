# Agent Sandbox controller — shutdown, TTL, suspend/resume, and ownership

Researched: 2026-10-10. Upstream repo `kubernetes-sigs/agent-sandbox`.
Versions checked: `v1.0.5` (2026-10-01) and `v1.0.6` (2026-10-08, latest release), plus `main`
(`d9c1a2b`, `v1.0.6-17-gd9c1a2b`).

**Parity note:** `git diff v1.0.6..main` is empty for `api/v1beta1/sandbox_types.go` and
`controllers/sandbox_controller.go`, so every line cited from `v1.0.6` below is byte-identical on
`main`. The `v1.0.5` shutdown/expiry logic is the same; only unrelated condition-reason strings and
event constants changed between `v1.0.5` and `v1.0.6` (e.g. `SandboxReasonSuspendedPodNotTerminated`
→ `SandboxReasonSuspendedPodTerminating`).

Primary sources are the API types, the controller reconcile loop, the CRDs, and the published docs.

---

## 1. What `shutdownTime` / `shutdownPolicy` actually do

`shutdownTime` is an absolute `date-time`; `shutdownPolicy` is `Delete | Retain` (default `Retain`).

API type — `api/v1beta1/sandbox_types.go` (`v1.0.6`):
- `ShutdownPolicy` enum: `#L314-L324`
- `Lifecycle.ShutdownTime` (`*metav1.Time`, `Format="date-time"`): `#L328-L334`
- `Lifecycle.ShutdownPolicy` (default `Retain`): `#L336-L347`

Controller logic — `controllers/sandbox_controller.go` (`v1.0.6`):
- `checkSandboxExpiry`: `#L1873-L1889` (compares `now` to `shutdownTime`; requeues at expiry).
- `handleSandboxExpiry`: `#L1791-L1868`.

What happens when the time passes:

1. **Pod is deleted** — only if its controller ownerReference points at this Sandbox
   (`checkOwnership` + `r.Delete`): `#L1796-L1818`.
2. **Service is deleted** — only if owned by this Sandbox: `#L1820-L1841`.
3. **Then `shutdownPolicy` decides the Sandbox object only:**
   - `Delete`: `r.Delete(ctx, sandbox)` (`#L1843-L1849`). The Sandbox object is deleted after
     Pod/Service removal.
   - `Retain`: the Sandbox object is kept; live status fields are cleared
     (`sandbox.Status = SandboxStatus{Conditions: ...}`) and `Ready=False` with reason
     `SandboxExpired` is set: `#L1851-L1865`.

So: **Pod and Service are always deleted on expiry regardless of policy; `shutdownPolicy` governs only
the Sandbox object.** The API doc comment says exactly this: "The underlying resources (Pod, Service)
are always deleted on expiry regardless of this policy; shutdownPolicy governs only the Sandbox
object." (`api/v1beta1/sandbox_types.go#L336-L343`; mirrored in
`docs/api.md#L54` and `#L195`). Published guide:
https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/site/content/docs/sandbox/lifecycle/_index.md#L12

### PVCs

`handleSandboxExpiry` deletes **only** the Pod and the Service. It never lists or deletes
`PersistentVolumeClaim`s (repo-wide: the only PVC writes in `controllers/sandbox_controller.go` are in
`reconcilePVCs`, `#L1711-L1788`).

- **Static PVCs referenced via `podTemplate.spec.volumes[].persistentVolumeClaim.claimName`** (e.g.
  PVCs QuickStack created) are never created, read, adopted, or given an ownerReference by the
  controller. `reconcilePVCs` iterates *only* `sandbox.Spec.VolumeClaimTemplates` (`#L1718`), so
  static claimName references are invisible to it. They are **not deleted on expiry, and not garbage
  collected when the Sandbox is deleted.** No code path touches them.
- **PVCs created from `spec.volumeClaimTemplates`** are different: the controller creates them and
  sets `ctrl.SetControllerReference(sandbox, pvc, ...)` (`#L1780`), so they *are* owned by the
  Sandbox. Expiry does **not** delete them directly, but a `shutdownPolicy: Delete` (or any manual
  Sandbox deletion) garbage-collects them via the ownerReference.

Net: `shutdownTime`/`shutdownPolicy` do not touch externally-created static PVCs. Only
template-derived PVCs are owned and thus GC'd with the Sandbox.

Sources:
- https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/controllers/sandbox_controller.go#L1791-L1868
- https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/controllers/sandbox_controller.go#L1711-L1788
- https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/api/v1beta1/sandbox_types.go#L328-L347

---

## 2. Is there a TTL / idle-expiry field on a **direct** `Sandbox`?

**No.** The direct `Sandbox` has exactly one time-based field: `spec.shutdownTime` (absolute). There is
no relative TTL, no `ttlSecondsAfterFinished`, and no idle/activity-expiry field.

- The whole time/lifecycle surface on the base `Sandbox` is the inlined `Lifecycle` struct with only
  `shutdownTime` and `shutdownPolicy` — `api/v1beta1/sandbox_types.go#L296-L298` and `#L326-L348`.
- `grep -i ttl` over `api/v1beta1/*.go` returns nothing. `ttlSecondsAfterFinished` exists **only** on
  the extension claim type: `extensions/api/v1beta1/sandboxclaim_types.go#L73-L77`.
- The CRD confirms field placement: `ttlSecondsAfterFinished` is present in
  `k8s/crds/extensions.agents.x-k8s.io_sandboxclaims.yaml#L82` and absent from
  `k8s/crds/agents.x-k8s.io_sandboxes.yaml` (only `shutdownPolicy`/`shutdownTime` there, `#L3966`,
  `#L3972`).

Note on the claim's TTL semantics for contrast: the claim's timer starts from the mirrored `Finished`
condition's `LastTransitionTime` (`sandboxclaim_types.go#L73-L74`), i.e. it is a
*post-finish* retention timer, not a liveness/idle timer. It is enforced by the **SandboxClaim**
controller, not the Sandbox controller: `reconcileExpired` deletes the Sandbox when the claim expires
(`extensions/controllers/sandboxclaim_controller.go#L679-L707`; expiration check at `#L569-L578`).
The claim's `shutdownTime` is explicitly **not** propagated to the underlying Sandbox
(`sandboxclaim_types.go` lifecycle comment; `docs/api.md#L303`).

---

## 3. Recommended way to auto-delete a direct Sandbox after a fixed time

Yes — **`spec.shutdownTime` (absolute) + `spec.shutdownPolicy: Delete` is the intended mechanism**;
it is the only auto-delete mechanism a direct `Sandbox` has.

The official guide demonstrates exactly this for a direct `Sandbox` (no claim): compute an absolute
timestamp, set `operatingMode: Running`, `shutdownPolicy: Delete`, `shutdownTime: ...`, then observe
the Sandbox disappear after the deadline.
https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/site/content/docs/sandbox/lifecycle/_index.md#L24-L66

Caveats to encode in QuickStack:

- There is no relative-TTL field on a direct Sandbox, so the caller must compute an absolute
  `date-time` (the SDK's `shutdown_after_seconds` only does this by writing the claim's lifecycle,
  per the same guide, `#L73`).
- `shutdownPolicy` defaults to `Retain` (`api/v1beta1/sandbox_types.go#L345`), so if you omit it the
  Sandbox object lingers (Pod/Service still deleted, `Ready=False/Expired`). Set `Delete` explicitly
  to remove the object.
- The same guide warns that with `restartPolicy: Always` a `ttl`-style cleanup never fires, but
  `shutdownTime` still does (`#L210-L240`) — another reason `shutdownTime` is the right primitive
  for a direct Sandbox.

---

## 4. Suspend → Running (`operatingMode`) for a direct Sandbox

**Pod is deleted and recreated; static PVC references are reattached.**

Suspend (`operatingMode: Suspended`): `reconcilePod` gracefully deletes the owned Pod — plain
`r.Delete(ctx, pod)` with no `gracePeriodSeconds` override — and clears the pod-name annotation:
`controllers/sandbox_controller.go#L1328-L1358`.

Resume (`operatingMode: Running`, Pod absent): `reconcileChildResources` calls `reconcilePVCs` then
`reconcilePod` (`#L431-L437`); with no Pod present, `reconcilePod` creates one from
`sandbox.Spec.PodTemplate.Spec.DeepCopy()` (`#L1506`), i.e. the entire pod template is copied
verbatim. Static references in `podTemplate.spec.volumes[].persistentVolumeClaim.claimName` are part
of that template and are therefore reproduced unchanged. Pod name is `sandbox.Name`
(`resolvePodName`, `#L193-L199`).

The controller does not create or delete the PVCs on suspend/resume; it only (re)creates the Pod that
points at them. KEP-694 states the design intent directly: on suspend the controller "will explicitly
*not* delete any attached PersistentVolumeClaims (PVCs) or stable network identities (Services)", and
on resume "The new Pod is seamlessly bound to the existing PVCs, ensuring state is retained."
https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/docs/keps/694-kep-for-suspend-and-resume-for-beta/README.md#L119-L128

Consequence: if the static PVC still exists, the resumed Pod reattaches it. If the external PVC was
deleted out from under the Sandbox, the recreated Pod will fail to schedule/mount (the controller does
not recreate externally-owned PVCs).

---

## 5. ownerReferences / cascade GC

The Sandbox is set as the **controller owner** (`controllerutil`/`ctrl.SetControllerReference`, which
writes an ownerReference with `controller: true`) of every resource it creates or adopts:

- **Pod**: adopt path `#L1398`; create path `#L1532`. (Controller also watches owned Pods:
  `Owns(&corev1.Pod{}, ...)`, `#L1944`.)
- **Service**: create path `#L1092`; update path `#L1176`. (`Owns(&corev1.Service{}, ...)`, `#L1945`.)
- **PVCs created from `spec.volumeClaimTemplates`**: adopt path `#L1746`; create path `#L1780`.

Therefore deleting the Sandbox cascades (native Kubernetes GC) to its Pod, Service, and
template-derived PVCs. There is **no finalizer on the Sandbox** that would block or special-case this
(the only mention of finalizers in the controller is stripping them from a cached Pod object in
`PodCacheTransform`, `#L106`).

**Static PVCs are excluded from ownership by construction, not by an explicit opt-out.** The
controller only ever assigns ownerReferences to PVCs it generated from `spec.volumeClaimTemplates`;
it never reads `podTemplate.spec.volumes[].persistentVolumeClaim.claimName`, so a QuickStack-created
PVC that the Pod mounts statically can never gain an ownerReference to the Sandbox. Consequently it is
immune to both expiry teardown (`handleSandboxExpiry` never touches PVCs) and Sandbox-deletion GC.

Sources:
- https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/controllers/sandbox_controller.go#L1532
- https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/controllers/sandbox_controller.go#L1711-L1788
- https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/controllers/sandbox_controller.go#L1791-L1868

---

## Could not confirm / caveats

- **No documented "idle" expiry.** Confirmed absence in types/CRD/controller; there is no
  controller-side activity/idle timer. If QuickStack needs idle-expiry it must implement its own
  watchdog that patches `shutdownTime`, or delete the Sandbox directly.
- **GC of template PVCs under `Retain`:** expiry with `Retain` deletes Pod/Service but not the
  Sandbox, so template-derived PVCs (owned by the Sandbox) survive expiry. They are only GC'd when the
  Sandbox object itself is deleted (`Delete`, or manual delete). This is inferred from
  `handleSandboxExpiry` not touching PVCs plus standard ownerReference GC; there is no explicit doc
  statement for this combination.
- **Deletion propagation for the expiry `r.Delete(sandbox)`** uses the client default (background),
  not foreground; the code does not set a `PropagationPolicy` there. The Pod/Service are deleted
  explicitly first, so ordering is preserved in practice (`#L1796-L1865`).
