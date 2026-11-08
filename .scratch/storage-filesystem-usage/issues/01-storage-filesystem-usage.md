Status: done

# StorageClass-independent App Volume filesystem usage

## Problem Statement

As a QuickStack user, I want to see how full an App Volume's filesystem is. Existing screens use Longhorn actual size, which includes snapshot-related storage and does not describe filesystem usage. It also ties the feature to Longhorn.

## Solution

Read App Volume filesystem usage through the Kubernetes API and Kubelet Summary API. Show reliable filesystem usage in existing App Volume screens and the Monitoring overview, independent of the Longhorn API. Clearly show unavailable usage where a trustworthy measurement cannot be obtained.

## User Stories

1. As an App owner, I want to see my App Volume's used filesystem space, so that I can judge remaining space.
2. As an App owner, I want to see filesystem capacity and available space, so that the usage has context.
3. As an App owner, I want a percentage based on filesystem usage and capacity, so that I can recognize a nearly full volume.
4. As an App owner, I want the existing App Volume UI to use the new measurements, so that it no longer confuses snapshot storage with filesystem usage.
5. As an operator, I want the Monitoring overview to show App Volume usage, so that I can find full volumes across projects.
6. As an operator, I want a shared App Volume shown at each relevant App mount, so that its users can see its usage.
7. As an operator, I want shared volumes counted once in totals, so that totals do not double-count usage.
8. As a user, I want missing, stale, unsupported, and inaccessible measurements identified, so that they are not mistaken for zero usage.
9. As a user, I want valid usage from supported volumes even when other volumes cannot be measured, so that partial failures do not hide useful information.
10. As a maintainer, I want a driver-specific extension point, so that additional storage drivers can be supported after their metrics are verified.
11. As an operator, I want local-path and unverified drivers marked unavailable, so that host filesystem usage is not presented as exclusive PVC usage.
12. As an operator, I want volume measurements to work across cluster nodes, so that App placement does not hide metrics.

## Implementation Decisions

- Replace Longhorn-derived filesystem usage for all existing consumers with a shared monitoring-service interface backed by node Summary API data accessed through the Kubernetes API. Do not require direct Longhorn API or pod access for these measurements. Other Longhorn features are unaffected.
- Map Summary volume data by namespace and PVC reference, discover nodes and associate values with configured App Volumes, and resolve shared App Volumes to the underlying PVC. Deduplicate that identity for totals, including across pods and nodes.
- Introduce a common storage-driver interface with driver-specific implementations. Determine the effective driver from the bound persistent volume and its provisioner/driver metadata, not merely the StorageClass name. Support verified Longhorn filesystem semantics initially. Treat local-path, unknown and unverified drivers as unavailable; make it possible to add verified drivers later.
- Use reported filesystem used, available and capacity values with their measurement time. Do not substitute configured PVC capacity, Longhorn actual size, host-wide values, zero, or stale values as if they were a fresh filesystem measurement. Define and enforce a bounded freshness policy; communicate unavailable or stale data and preserve available results on partial failure.
- Include configured App Volumes even when unbound, unmounted, unsupported, or missing metrics. Handle zero or missing capacity safely. Sum unique volumes and identify incomplete totals rather than presenting them as complete.
- Account for the existing installation's broad node proxy access; avoid introducing broader access. Node proxy is privileged, so do not expose a generic proxy endpoint to users.
- Existing App Volume and Monitoring authorization applies. No Agent Volume monitoring is added.

## Testing Decisions

- Test observable behavior at the existing monitoring-service boundary using representative Kubernetes responses and database records; test UI behavior where necessary. Follow existing monitoring service unit-test and component-test patterns.
- Cover Longhorn metrics, multi-node lookup, app and shared-volume mapping, deduplication, unmounted/unbound volumes, local-path and unknown drivers, stale and missing fields, unavailable nodes, partial results and safe capacity calculations.
- Test externally visible results and error states, not internal helper call sequences. Validate against a real supported k3s cluster where available.

## Out of Scope

Historical metrics, Agent Volumes, supporting unverified storage drivers, Longhorn snapshot or replica storage accounting, alerting and export.

## Further Notes

The current cluster returned Longhorn filesystem metrics through the Summary API. A local-path example reported the host filesystem, and not all PVCs appeared in the response. The history issue builds on this feature.

## Comments

Implemented on `integration/storage-filesystem-usage` (commits `0a5666a0`, `181af6ce`). Targeted tests and lint pass; real-cluster validation remains outstanding.
