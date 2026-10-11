import { Sandbox, SandboxClaim } from "@/server/adapter/api-clients/types/agents.models";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { Constants } from "@/shared/utils/constants";

const TERMINAL_CLAIM_FAILURE_REASONS = new Set([
    'TemplateNotFound',
    'WarmPoolNotFound',
    'InvalidMetadata',
    'EnvVarsInjectionRejected',
    'VolumeClaimTemplatesError',
    'ReconcilerError',
    'InvalidConfiguration',
]);

export type AgentVolumeTypeLike = { volumeType: string };

export class AgentSandboxUtils {

    static usesPerCustomTagVolume(agentVolumes: AgentVolumeTypeLike[]): boolean {
        return agentVolumes.some(volume => volume.volumeType === Constants.QS_VOLUME_TYPE_PER_CUSTOM_TAG);
    }

    /** Maps a SandboxClaim, optionally with its Sandbox, to a deployment status. */
    static resolveSandboxStatus(
        claim: SandboxClaim | null | undefined,
        sandbox?: Sandbox | null,
    ): DeploymentStatus {
        if (!claim) {
            return 'SHUTDOWN';
        }
        if (claim.metadata?.deletionTimestamp) {
            return 'SHUTTING_DOWN';
        }

        if (sandbox) {
            const suspendedCondition = (sandbox.status?.conditions ?? []).find(
                (condition) => condition.type === 'Suspended',
            );
            if (suspendedCondition?.status === 'True' || sandbox.spec?.operatingMode === 'Suspended') {
                return 'SUSPENDED';
            }
        }

        const conditions = claim.status?.conditions ?? [];
        const ready = conditions.find(
            (condition) => (condition.type === 'Ready' || condition.type === 'Available') && condition.status === 'True',
        );
        if (ready) {
            return 'DEPLOYED';
        }

        const readinessCondition = conditions.find(
            (condition) => condition.type === 'Ready' || condition.type === 'Available',
        );
        if (!sandbox && readinessCondition?.reason === 'SandboxSuspended') {
            return 'SUSPENDED';
        }
        if (readinessCondition?.reason === 'ClaimExpired' || readinessCondition?.reason === 'Expired') {
            return 'SHUTTING_DOWN';
        }
        if (TERMINAL_CLAIM_FAILURE_REASONS.has(readinessCondition?.reason ?? '')) {
            return 'ERROR';
        }

        return 'DEPLOYING';
    }

    /** Maps a directly created base Sandbox to a deployment status. */
    static resolveSandboxObjectStatus(sandbox: Sandbox | null | undefined): DeploymentStatus {
        if (!sandbox) {
            return 'SHUTDOWN';
        }
        if (sandbox.metadata?.deletionTimestamp) {
            return 'SHUTTING_DOWN';
        }

        const conditions = sandbox.status?.conditions ?? [];
        const suspendedCondition = conditions.find(
            (condition) => condition.type === 'Suspended' && condition.status === 'True',
        );
        if (suspendedCondition || sandbox.spec?.operatingMode === 'Suspended') {
            return 'SUSPENDED';
        }

        const ready = conditions.find(
            (condition) => (condition.type === 'Ready' || condition.type === 'Available') && condition.status === 'True',
        );
        if (ready) {
            return 'DEPLOYED';
        }

        const readinessCondition = conditions.find(
            (condition) => condition.type === 'Ready' || condition.type === 'Available',
        );
        if (TERMINAL_CLAIM_FAILURE_REASONS.has(readinessCondition?.reason ?? '')) {
            return 'ERROR';
        }

        return 'DEPLOYING';
    }
}
