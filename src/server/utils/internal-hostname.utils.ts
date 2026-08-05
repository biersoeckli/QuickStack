
export class InternalHostnameUtils {
    static getInternalBaseUrlForApp(app: {
        id: string;
        projectId: string;
    }, port?: number) {
        if (port) {
            return `http://svc-${app.id}.${app.projectId}.svc.cluster.local:${port}`;
        }
        return `http://svc-${app.id}.${app.projectId}.svc.cluster.local`;
    }

    static getInternalBaseUrl(podName: string, projectId: string, port?: number) {
        if (port) {
            return `http://${podName}.${projectId}.svc.cluster.local:${port}`;
        }
        return `http://${podName}.${projectId}.svc.cluster.local`;
    }
}