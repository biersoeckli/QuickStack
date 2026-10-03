export class InternalHostnameUtils {
    static getInternalBaseUrlForApp(app: { id: string; projectId: string }, port?: number) {
        return this.getInternalBaseUrl(`svc-${app.id}`, app.projectId, port);
    }

    static getInternalBaseUrl(podName: string, projectId: string, port?: number) {
        const portSuffix = port ? `:${port}` : '';
        return `http://${podName}.${projectId}.svc.cluster.local${portSuffix}`;
    }
}
