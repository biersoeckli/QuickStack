import { act, renderHook } from '@testing-library/react';
import {
    DrawerSessionUtils,
    useProjectNetworkGraphDrawerSession,
} from './project-network-graph-drawer-session';

describe('DrawerSessionUtils.resolveTab', () => {
    test.each([
        ['APP', 'credentials', 'deployments'],
        ['POSTGRES', 'credentials', 'credentials'],
        ['APP', 'logs', 'logs'],
        ['APP', 'backups', 'backups'],
        ['APP', 'unknown', 'deployments'],
        ['APP', null, 'deployments'],
    ] as const)('normalizes %s requested tab %s to %s', (appType, requestedTab, expected) => {
        expect(DrawerSessionUtils.resolveTab(appType, requestedTab)).toBe(expected);
    });

    it('rejects the backups tab when the app has no volumes', () => {
        expect(DrawerSessionUtils.resolveTab('APP', 'backups', false)).toBe('deployments');
    });
});

describe('useProjectNetworkGraphDrawerSession', () => {
    test('keeps its interface stable across an unrelated parent render', () => {
        const searchParams = new URLSearchParams('drawerTab=deployments');
        const appIds = new Set(['app-1']);
        const { result, rerender } = renderHook(() =>
            useProjectNetworkGraphDrawerSession({ searchParams, appIds }),
        );

        const session = result.current;
        rerender();

        expect(result.current).toBe(session);
    });

    test('keeps the selected node until the drawer closing animation completes', () => {
        const searchParams = new URLSearchParams('drawerAppId=app-1&drawerTab=logs');
        const appIds = new Set(['app-1']);
        const { result } = renderHook(() =>
            useProjectNetworkGraphDrawerSession({ searchParams, appIds }),
        );

        expect(result.current.selectedNodeId).toBe('APP:app-1');
        expect(result.current.open).toBe(true);
        expect(result.current.requestedTab).toBe('logs');

        act(() => result.current.onOpenChange(false));

        expect(result.current.selectedNodeId).toBe('APP:app-1');
        expect(result.current.open).toBe(false);

        act(() => result.current.onOpenChangeComplete(false));

        expect(result.current.selectedNodeId).toBeUndefined();
    });

    test('clears an unknown drawer app from the URL', () => {
        const searchParams = new URLSearchParams('drawerAppId=missing&drawerTab=logs');
        const appIds = new Set(['app-1']);
        const { result } = renderHook(() =>
            useProjectNetworkGraphDrawerSession({ searchParams, appIds }),
        );

        expect(result.current.selectedNodeId).toBeUndefined();
    });
});
