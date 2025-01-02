export class Tags {

    static users() {
        return `users`;
    }

    static projects() {
        return `projects`;
    }

    static s3Targets() {
        return `targets`;
    }

    static volumeBackups() {
        return `volume-backups`;
    }

    static apps(projectId: string) {
        return `apps-${projectId}`;
    }

    static parameter() {
        return `parameter`;
    }

    static app(appId: string) {
        return `app-${appId}`;
    }

    static appBuilds(appId: string) {
        return `app-build-${appId}`;
    }

    static nodeInfos() {
        return `node-infos`;
    }
}