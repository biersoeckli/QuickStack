import { PathBuilderUtils } from './path-builder.utils';
import { DrawerSessionUtils } from '@/app/project/[projectId]/app-components/project-network-graph/project-network-graph-drawer-session';

describe('PathBuilderUtils.projectAppDrawer', () => {
    it('builds an encoded drawer URL with the default tab', () => {
        expect(PathBuilderUtils.projectAppDrawer('project / one', 'app & one')).toBe(
            '/project/project%20%2F%20one?drawerAppId=app+%26+one&drawerTab=deployments',
        );
    });

    it('preserves the requested drawer and project tabs', () => {
        expect(PathBuilderUtils.projectAppDrawer('project-1', 'app-1', 'stats', 'table')).toBe(
            '/project/project-1?drawerAppId=app-1&drawerTab=stats&tab=table',
        );
    });

    it('produces a drawer tab the session accepts', () => {
        const url = new URL(PathBuilderUtils.projectAppDrawer('project-1', 'app-1', 'backups'), 'https://quickstack.dev');

        expect(DrawerSessionUtils.resolveTab('APP', url.searchParams.get('drawerTab'), true)).toBe('backups');
    });
});
