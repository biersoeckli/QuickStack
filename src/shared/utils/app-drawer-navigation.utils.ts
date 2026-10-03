export const appDrawerTabValues = [
    'deployments',
    'credentials',
    'logs',
    'stats',
    'backups',
    'settings',
] as const;

export type AppDrawerTab = (typeof appDrawerTabValues)[number];

export const defaultAppDrawerTab: AppDrawerTab = 'deployments';

export class AppDrawerNavigationUtils {
    static resolveTab(
        appType: string | undefined,
        requestedTab: string | null | undefined,
        hasVolumes = true,
    ): AppDrawerTab {
        if (!appDrawerTabValues.includes(requestedTab as AppDrawerTab)) return defaultAppDrawerTab;
        if (requestedTab === 'credentials' && appType === 'APP') return defaultAppDrawerTab;
        if (requestedTab === 'backups' && !hasVolumes) return defaultAppDrawerTab;
        return requestedTab as AppDrawerTab;
    }
}
