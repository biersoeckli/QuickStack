import { AgentSandboxUtils } from "./agent-sandbox.utils";

describe('AgentSandboxUtils', () => {
    const claimWith = (conditions: any[], metadata: Record<string, any> = { name: 'claim' }) =>
        ({ metadata, status: { conditions } }) as any;

    describe('resolveSandboxStatus', () => {
        it.each([
            [null, undefined, 'SHUTDOWN'],
            [claimWith([{ type: 'Ready', status: 'True' }], { deletionTimestamp: '2026-08-31T12:00:00Z' }), undefined, 'SHUTTING_DOWN'],
            [claimWith([{ type: 'Ready', status: 'True' }]), undefined, 'DEPLOYED'],
            [claimWith([{ type: 'Ready', status: 'False', reason: 'DependenciesNotReady' }]), undefined, 'DEPLOYING'],
            [claimWith([{ type: 'Ready', status: 'False', reason: 'WarmPoolNotFound' }]), undefined, 'ERROR'],
            [claimWith([{ type: 'Ready', status: 'False', reason: 'ClaimExpired' }]), undefined, 'SHUTTING_DOWN'],
            [claimWith([{ type: 'Ready', status: 'False', reason: 'SandboxSuspended' }]), undefined, 'SUSPENDED'],
            [claimWith([{ type: 'Ready', status: 'False' }]), { spec: { operatingMode: 'Suspended' } }, 'SUSPENDED'],
            [claimWith([{ type: 'Ready', status: 'False' }]), { status: { conditions: [{ type: 'Suspended', status: 'True' }] } }, 'SUSPENDED'],
            [claimWith([{ type: 'Ready', status: 'False', reason: 'SandboxSuspended' }]), { spec: { operatingMode: 'Running' } }, 'DEPLOYING'],
        ])('returns %s for the matching claim and Sandbox state', (claim, sandbox, expectedStatus) => {
            expect(AgentSandboxUtils.resolveSandboxStatus(claim, sandbox)).toBe(expectedStatus);
        });
    });

    describe('resolveSandboxObjectStatus', () => {
        it.each([
            [null, 'SHUTDOWN'],
            [{ metadata: { deletionTimestamp: '2026-08-31T12:00:00Z' } }, 'SHUTTING_DOWN'],
            [{ spec: { operatingMode: 'Suspended' } }, 'SUSPENDED'],
            [{ status: { conditions: [{ type: 'Suspended', status: 'True' }] } }, 'SUSPENDED'],
            [{ status: { conditions: [{ type: 'Ready', status: 'True' }] } }, 'DEPLOYED'],
            [{ status: { conditions: [{ type: 'Ready', status: 'False', reason: 'InvalidConfiguration' }] } }, 'ERROR'],
            [{ status: { conditions: [{ type: 'Ready', status: 'False' }] } }, 'DEPLOYING'],
        ])('returns %s for the matching Sandbox state', (sandbox, expectedStatus) => {
            expect(AgentSandboxUtils.resolveSandboxObjectStatus(sandbox as any)).toBe(expectedStatus);
        });
    });
});
