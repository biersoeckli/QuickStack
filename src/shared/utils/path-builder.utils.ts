import { defaultAppDrawerTab, type AppDrawerTab } from './app-drawer-navigation.utils';
import { defaultAgentDrawerTab, type AgentDrawerTab } from './agent-drawer-navigation.utils';

export class PathBuilderUtils {
    static projectAppDrawer(
        projectId: string,
        appId: string,
        drawerTab: AppDrawerTab = defaultAppDrawerTab,
        projectTab?: string,
    ) {
        const params = new URLSearchParams({
            drawerAppId: appId,
            drawerTab,
        });
        if (projectTab) params.set('tab', projectTab);

        return `/project/${encodeURIComponent(projectId)}?${params.toString()}`;
    }

    static projectAgentDrawer(
        projectId: string,
        agentId: string,
        drawerTab: AgentDrawerTab = defaultAgentDrawerTab,
        projectTab?: string,
    ) {
        const params = new URLSearchParams({
            drawerAgentId: agentId,
            drawerTab,
        });
        if (projectTab) params.set('tab', projectTab);

        return `/project/${encodeURIComponent(projectId)}?${params.toString()}`;
    }
}
