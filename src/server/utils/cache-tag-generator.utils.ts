export class Tags {

    static users() {
        return `users`;
    }

    static userGroups() {
        return `roles`;
    }

    static projects() {
        return `projects`;
    }

    static s3Targets() {
        return `targets`;
    }

    static llmGateways() {
        return `llm-gateways`;
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

    static agents(projectId: string) {
        return `agents-${projectId}`;
    }

    static agent(agentId: string) {
        return `agent-${agentId}`;
    }

    static apiKey(userId: string) {
        return `api-key-${userId}`;
    }

    static appBuilds(appId: string) {
        return `app-build-${appId}`;
    }

    static nodeInfos() {
        return `node-infos`;
    }

    static quickStackVersionInfo() {
        return `quickstack-version-info`;
    }
}
