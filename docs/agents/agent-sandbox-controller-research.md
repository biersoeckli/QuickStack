# Agent Sandbox controller — env, init/sidecar, termination research

Researched: 2026-10-09. Upstream repo `kubernetes-sigs/agent-sandbox`.
Primary sources: source at tag `v1.0.6` (latest release; `v1.0.5` behavior verified identical for the
env-injection path), release notes, CRDs, KEPs, and Kubernetes upstream sidecar/pod-lifecycle docs.

Versions checked: `v1.0.5` (2026-10-01) and `v1.0.6` (2026-10-08). `v1.0.6` is the latest release.

---

## 1. `SandboxClaim.spec.env` scope — does it reach init / native sidecar containers?

**Short answer: No, not by default, and native sidecars are *not* treated specially.** Default (no
`containerName`) env vars are injected into the **first regular container only**. Env vars *can*
reach an init container or a native sidecar **only if the claim explicitly sets `containerName`** to
that container's name. There is no "apply to all containers" channel.

`SandboxClaim.spec.env` entries are `EnvVar`:

```go
type EnvVar struct {
	// name of the environment variable.
	// +required
	Name string `json:"name"`
	// value of the environment variable.
	// +required
	Value string `json:"value"`
	// containerName specifies the target container for the environment variable.
	// If not specified, it defaults to the first container defined in the template.
	// +optional
	ContainerName string `json:"containerName,omitempty"`
}
```

Source: `extensions/api/v1beta1/sandboxclaim_types.go#L92-L106`
https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/extensions/api/v1beta1/sandboxclaim_types.go#L92-L106

The controller groups env by container. Unnamed envs go to `defaultEnvs`; named envs are keyed by
`containerName`. It validates names against **both** `InitContainers` and `Containers`, then injects:

- into matching **init containers** (`sandbox.Spec.PodTemplate.Spec.InitContainers`), and
- into matching **regular containers**,
- with `defaultEnvs` appended **only when `i == 0`** of the regular `Containers` slice.

```go
// Inject into init containers
for i := range sandbox.Spec.PodTemplate.Spec.InitContainers {
	container := &sandbox.Spec.PodTemplate.Spec.InitContainers[i]
	if envs, ok := envsByContainer[container.Name]; ok {
		if err := r.injectEnvs(...); err != nil { ... }
	}
}
// Inject into regular containers
for i := range sandbox.Spec.PodTemplate.Spec.Containers {
	container := &sandbox.Spec.PodTemplate.Spec.Containers[i]
	var envsToInject []extensionsv1beta1.EnvVar
	if envs, ok := envsByContainer[container.Name]; ok {
		envsToInject = append(envsToInject, envs...)
	}
	if i == 0 { // Default envs go to the first main container
		envsToInject = append(envsToInject, defaultEnvs...)
	}
	...
}
```

Source: `extensions/controllers/sandboxclaim_controller.go#L1831-L1897`
https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/extensions/controllers/sandboxclaim_controller.go#L1831-L1897

Consequences:

- Default env → **first regular container only**; **never** init containers or native sidecars.
- `containerName: <name>` → that container, whether it is a regular container, a plain init
  container, **or a native sidecar** (a native sidecar is an `initContainers` entry with
  `restartPolicy: Always`, so it is in the `InitContainers` loop).
- Injection is gated by `SandboxTemplate.spec.envVarsInjectionPolicy` (`Disallowed` default,
  `Allowed`, `Overrides`); setting any claim env forces a **cold start** (cannot adopt a warm Pod).
  Source: `extensions/api/v1beta1/sandboxtemplate_types.go#L32-L58, L145`; docs `docs/api.md#L474`.

**Per-start channels that DO reach init / native sidecar containers** (there is no generated
per-start Secret in the controller — a repo-wide search found no `Secret` creation in
`controllers/`, `extensions/`, or `internal/`):

- **Pod metadata + downward API.** The claim stamps the Sandbox Pod template with
  `agents.x-k8s.io/claim-uid` = `claim.UID` (`SandboxIDLabel`), plus user-supplied
  `claim.spec.additionalPodMetadata` labels/annotations, and propagation-tracking annotations.
  Pod template labels/annotations are copied onto the Pod (`controllers/sandbox_controller.go#L1461-L1504`),
  so any init/sidecar container can read them with `fieldRef: metadata.labels['agents.x-k8s.io/claim-uid']`
  or `metadata.annotations[...]`. Source:
  `extensions/controllers/sandboxclaim_controller.go#L975-L990` (identity labels) and `#L1824-L1829`
  (pod template), `extensions/api/v1beta1/sandboxtemplate_types.go#L40`
  (`SandboxIDLabel = "agents.x-k8s.io/claim-uid"`).
- **Named-container env injection** (above) is itself the per-start env channel for init/sidecars.
- **Mounted volumes** (emptyDir, PVC from `volumeClaimTemplates`, ConfigMap/Secret referenced by the
  template) can be mounted by init/sidecar containers just like any Pod.
- Caveat: `claim-uid` identifies the *claim*, not each resume; on suspend/resume the Pod is
  recreated but the claim UID is unchanged. There is no controller-generated per-resume token/Secret.

---

## 2. Does `SandboxTemplate.podTemplate.spec` support `initContainers`, faithfully copied + native sidecars?

**Short answer: Yes, yes, yes.**

- The CRD schema for `SandboxTemplate.spec.podTemplate.spec.initContainers` exists, including a
  per-container `restartPolicy` (plain `string`, so `Always` passes through). Source:
  `k8s/crds/extensions.agents.x-k8s.io_sandboxtemplates.yaml#L2267` and `#L2767`.
  https://github.com/kubernetes-sigs/agent-sandbox/blob/v1.0.6/k8s/crds/extensions.agents.x-k8s.io_sandboxtemplates.yaml#L2267
- `podTemplate.spec` is the full `corev1.PodSpec` in the Go types (`PodTemplate.Spec corev1.PodSpec`,
  `api/v1beta1/sandbox_types.go#L208-L216`), so `initContainers` is a first-class field.
- The Sandbox is created by deep-copying the template's blueprint, then the Pod spec is a
  deep-copy of `sandbox.Spec.PodTemplate.Spec`, so init containers (and native sidecars) are copied
  verbatim onto the Pod:
  `sandbox.Spec.SandboxBlueprint = *template.Spec.SandboxBlueprint.DeepCopy()`
  (`extensions/controllers/sandboxclaim_controller.go#L1792`) and
  `mutatedSpec := sandbox.Spec.PodTemplate.Spec.DeepCopy()` (`controllers/sandbox_controller.go#L1506-L1530`).
- **Native sidecars are explicitly recognized** by the controller: when deriving the Service ports
  it counts ports from `InitContainers` only when the entry is a native sidecar
  (`RestartPolicy != nil && *RestartPolicy == corev1.ContainerRestartPolicyAlways`). Source:
  `controllers/sandbox_controller.go#L1005-L1009`, with a unit test at
  `controllers/sandbox_controller_test.go#L3644, L3726`.
- `ApplySandboxSecureDefaults` (the only PodSpec mutation) touches `AutomountServiceAccountToken`
  and DNS only — it never drops or rewrites `initContainers`.
  `extensions/controllers/utils.go#L24-L48`.

---

## 3. Termination ordering for native sidecars and the grace period

This is **Kubernetes kubelet behavior**, not agent-sandbox-specific. The controller just issues a
normal Pod DELETE; Kubernetes does the rest.

- **Ordering: sidecars stop after all regular containers**, in **reverse order of their appearance**
  in the Pod spec.
  > "If your Pod includes one or more sidecar containers (init containers with an `Always` restart
  > policy), the kubelet will delay sending the TERM signal to these sidecar containers until the
  > last main container has fully terminated. The sidecar containers will be terminated in the
  > reverse order they are defined in the Pod spec."
  Source: "Pod shutdown and sidecar containers" — https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#termination-with-sidecars
- **Grace period: it is a single shared Pod-level budget; native sidecars do NOT get an extra
  grace period.**
  > "This means that slow termination of a main container will also delay the termination of the
  > sidecar containers. If the grace period expires before the termination process is complete, the
  > Pod may enter forced termination. In this case, all remaining containers in the Pod will be
  > terminated simultaneously with a short grace period."
  Same source, above.
  And on the sidecar page:
  > "When other containers take all allotted graceful termination time, the sidecar containers will
  > receive the `SIGTERM` signal, followed by the `SIGKILL` signal, before they have time to
  > terminate gracefully. So exit codes different from `0` ... for sidecar containers are normal on
  > Pod termination and should be generally ignored by the external tooling."
  https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/
- Feature status (upstream): **stable since v1.33**, first available v1.28, active by default since
  v1.29.
  > "Feature state: Stable since Kubernetes v1.33 ... It was first available in the v1.28 release.
  > You can no longer disable or opt out of this feature or behavior (it is locked) ..."
  https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/

---

## 4. Termination paths on claim delete / suspend-resume / eviction-drain

All paths reduce to a normal Kubernetes Pod deletion (no `gracePeriodSeconds: 0` override, no
controller finalizer that strips grace). Grace period and native-sidecar shutdown are therefore
honored; the only difference is who initiates the DELETE.

- **Claim deleted (normal).** `SandboxClaim` has no finalizer; the controller returns early on
  `DeletionTimestamp` (`extensions/controllers/sandboxclaim_controller.go#L339-L341`). Because the
  Sandbox is created with the claim as controller owner
  (`controllerutil.SetControllerReference(claim, sandbox, ...)`,
  `extensions/controllers/sandboxclaim_controller.go#L1902`) and the Pod is owned by the Sandbox,
  Kubernetes **garbage collection** cascades Claim → Sandbox → Pod using normal (graceful) deletion.
- **Claim expiry with `shutdownPolicy: Delete` / `DeleteForeground`.** The controller explicitly
  deletes the claim; `DeleteForeground` sets `client.PropagationPolicy(metav1.DeletePropagationForeground)`
  so the claim lingers until children are gone.
  `extensions/controllers/sandboxclaim_controller.go#L366-L388`.
- **`Sandbox.spec.operatingMode: Suspended`.** The Sandbox controller explicitly issues a **graceful**
  Pod delete:
  ```go
  if sandbox.Spec.OperatingMode == sandboxv1beta1.SandboxOperatingModeSuspended {
      if pod != nil {
          if pod.DeletionTimestamp.IsZero() {
              logger.Info("Deleting Pod because .Spec.OperatingMode is Suspended", ...)
              if err := r.Delete(ctx, pod); err != nil { ... }   // no grace override
  ```
  `controllers/sandbox_controller.go#L1328-L1342`. PVCs/Services are retained. KEP-694 states the
  intent: "When the controller observes `spec.operatingMode: Suspended`, it explicitly triggers a
  graceful deletion of the underlying Pod."
  `docs/keps/694-kep-for-suspend-and-resume-for-beta/README.md`.
- **Resume (`operatingMode: Running` with no Pod).** Controller builds a new Pod from
  `spec.podTemplate` and rebinds existing PVCs. KEP-694, same source.
- **`shutdownTime` expiry.** Pod and Service are deleted first (`r.Delete`), then optionally the
  Sandbox depending on `shutdownPolicy`. `controllers/sandbox_controller.go#L1792-L1851`.
- **Pod eviction / node drain.** The eviction API deletes the Pod with the Pod's grace period; if
  the Sandbox is `Running`, the controller recreates the Pod. The controller adds no PDB and does
  not special-case eviction.

Flag: no agent-sandbox source forces `gracePeriodSeconds` or bypasses kubelet sidecar shutdown, so
upstream semantics in Q3 apply unchanged.

---

## 5. Minimum Kubernetes version + native sidecar status

**Status of native sidecars in the controller: supported and honored** (see Q2/Q3) — contingent on
the cluster running a Kubernetes version where the feature gate is available. It is **stable since
Kubernetes 1.33**, beta and enabled-by-default since **1.29**, first available 1.28
(https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/). On <1.29 the
`initContainers[].restartPolicy` field will be rejected by the API server.

**Minimum Kubernetes version: NOT officially documented as of 2026-10-09.** This is a genuine gap:

- The only explicit figure in the repo is the OLM/operator bundle prerequisite:
  `* A Kubernetes cluster (v1.26+)`.
  `olm/bundle/manifests/agent-sandbox-operator.clusterserviceversion.yaml#L143`
  (and `olm/config/manifests/bases/...`), carried into the `v1.0.5` bundle. This appears to be
  boilerplate and is **not** backed by a tested compatibility matrix; treat with caution, especially
  given the dependency on native sidecars (1.29+).
- Open issue **#1823 "docs: Document the Minimum Kubernetes Version for Agent Sandbox"** (created
  2026-10-02, still open) confirms it is undocumented and unknown to the team:
  > "I was investigating what the minimum version of Kubernetes that Agent Sandbox can run on today,
  > and did not find an obvious answer in the repo. There was also not a known answer from the team
  > in Slack. I will run the E2E test suite on older clusters to find which version tests fail on,
  > and then submit a PR with documentation updates reporting the last working version..."
  https://github.com/kubernetes-sigs/agent-sandbox/issues/1823
- Release notes for `v1.0.5` and `v1.0.6` (`https://github.com/kubernetes-sigs/agent-sandbox/releases/tag/v1.0.5`,
  `.../v1.0.6`) state **no** minimum Kubernetes version. Go deps are `k8s.io/api v0.37.1`
  (`go.mod`), but that is the build library version, not a supported-floor guarantee. CI/envtest
  uses Kubernetes 1.36.2 (`dev/tools/test-policy-vap`) and kops 1.35, all far above any floor.

**Recommendation:** if sidecars are required, require **Kubernetes >= 1.29** (feature default-on) and
prefer **>= 1.33** (GA) until upstream documents and tests a floor.

---

## Could not confirm

- A formally tested/supported minimum Kubernetes version for any release; only the untested OLM
  `v1.26+` boilerplate and the open issue #1823.
- Any per-start generated Secret in the controller (none exists).
- Whether resume gets a distinct per-start marker for init/sidecar containers; `claim-uid` is
  per-claim, not per-resume.
