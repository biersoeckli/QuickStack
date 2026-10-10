export type AgentVolumeTypeLike = { volumeType: string };

export class AgentVolumeUtils {

    static usesPerCustomTagVolume(agentVolumes: AgentVolumeTypeLike[]): boolean {
        return agentVolumes.some(volume => volume.volumeType === 'PER_CUSTOM_TAG');
    }
}
