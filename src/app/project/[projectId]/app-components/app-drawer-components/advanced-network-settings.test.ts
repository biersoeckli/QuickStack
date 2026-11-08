import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NestedDrawerProvider } from './nested-drawer';
import { DrawerSettings } from './app-details-settings';
import { AppDrawerAppContext } from './app-drawer-app-context';
import { RolePermissionEnum } from '@/shared/model/role-extended.model';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';

vi.mock('@/components/ui/drawer', () => ({
    Drawer: ({ children }: React.PropsWithChildren) => children,
    DrawerContent: ({ children }: React.PropsWithChildren) => children,
    DrawerDescription: ({ children }: React.PropsWithChildren) => children,
    DrawerHeader: ({ children }: React.PropsWithChildren) => children,
    DrawerTitle: ({ children }: React.PropsWithChildren) => children,
}));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: React.PropsWithChildren) => children }));
vi.mock('@/app/project/app/[appId]/domains/node-ports', () => ({ default: ({ app }: { app: AppExtendedModel }) => React.createElement('div', null, `Ports: ${app.appNodePorts.length}`) }));
vi.mock('@/app/project/app/[appId]/advanced/basic-auth', () => ({ default: ({ app }: { app: AppExtendedModel }) => React.createElement('div', null, `Credentials: ${app.appBasicAuths.length}`) }));
vi.mock('@/app/project/app/[appId]/advanced/actions', () => ({ saveHealthCheck: vi.fn() }));
vi.mock('@/app/project/app/[appId]/advanced/health-check-settings', () => ({ default: () => null }));
vi.mock('@/app/project/app/[appId]/advanced/network-policy', () => ({ default: () => null }));
vi.mock('@/app/project/app/[appId]/environment/env-edit', () => ({ default: () => null }));
vi.mock('@/app/project/app/[appId]/general/app-container-config', () => ({ default: () => null }));
vi.mock('@/app/project/app/[appId]/general/app-rate-limits', () => ({ default: () => null }));
vi.mock('@/app/project/app/[appId]/general/app-source', () => ({ default: () => null }));
vi.mock('@/app/project/app/[appId]/volumes/storages', () => ({ default: () => null }));
vi.mock('@/components/custom/domains-card', () => ({ default: () => null }));
vi.mock('@/components/custom/file-mounts-card', () => ({ default: () => null }));
vi.mock('./app-details-environment', () => ({ DrawerEnvironment: () => null }));

afterEach(cleanup);

it('updates network settings in an open drawer when app data changes', () => {
    const app = { id: 'app', appNodePorts: [], appBasicAuths: [], appDomains: [], appFileMounts: [] } as unknown as AppExtendedModel;
    const view = (value: AppExtendedModel) => React.createElement(AppDrawerAppContext.Provider, { value },
        React.createElement(NestedDrawerProvider, null,
            React.createElement(DrawerSettings, { app: value, role: RolePermissionEnum.READWRITE, storageClasses: [] }),
        ),
    );
    const { rerender } = render(view(app));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced network settings' }));
    expect(screen.getByText('Ports: 0')).toBeTruthy();
    rerender(view({ ...app, appNodePorts: [{}], appBasicAuths: [{}] } as AppExtendedModel));
    expect(screen.getByText('Ports: 1')).toBeTruthy();
    expect(screen.getByText('Credentials: 1')).toBeTruthy();
});
