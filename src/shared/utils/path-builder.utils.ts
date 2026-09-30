export class PathBuilderUtils {
    static projectAppDrawer(
        projectId: string,
        appId: string,
        drawerTab = 'deployments',
        projectTab?: string,
    ) {
        const params = new URLSearchParams({
            drawerAppId: appId,
            drawerTab,
        });
        if (projectTab) params.set('tab', projectTab);

        return `/project/${encodeURIComponent(projectId)}?${params.toString()}`;
    }
}
