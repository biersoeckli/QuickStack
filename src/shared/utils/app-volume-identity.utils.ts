export class AppVolumeIdentityUtils {
  static underlyingId(id: string, sharedVolumeId: string | null): string {
    return sharedVolumeId || id;
  }

  static key(projectId: string, id: string, sharedVolumeId: string | null): string {
    return `${projectId}/${this.underlyingId(id, sharedVolumeId)}`;
  }

  static observationKey(projectId: string, pvcName: string): string {
    return `${projectId}/${pvcName}`;
  }
}
