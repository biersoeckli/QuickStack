import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServerSettingsTabs } from './server-settings-tabs';

const router = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => router,
    usePathname: () => '/settings/server',
    useSearchParams: () => new URLSearchParams('foo=bar'),
}));

const TabsUnderTest = ServerSettingsTabs as React.ComponentType<{ defaultTab: string }>;

function renderTabs(defaultTab = 'general') {
    return render(
        React.createElement(
            TabsUnderTest,
            { defaultTab },
            React.createElement(
                TabsList,
                { key: 'list' },
                React.createElement(TabsTrigger, { value: 'general', key: 'general' }, 'General'),
                React.createElement(TabsTrigger, { value: 'networking', key: 'networking' }, 'Networking'),
            ),
            React.createElement(TabsContent, { value: 'general', key: 'general' }, 'General content'),
            React.createElement(TabsContent, { value: 'networking', key: 'networking' }, 'Networking content'),
        ),
    );
}

describe('ServerSettingsTabs client-side navigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, '', '/settings/server?foo=bar');
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('updates the URL on a tab click without a server navigation', () => {
        renderTabs();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Networking' }));

        expect(window.location.pathname).toBe('/settings/server');
        expect(window.location.search).toBe('?foo=bar&tab=networking');
        expect(router.push).not.toHaveBeenCalled();
        expect(router.replace).not.toHaveBeenCalled();
    });

    it('keeps inactive tab content unmounted', () => {
        renderTabs();

        expect(screen.getByText('General content')).toBeTruthy();
        expect(screen.queryByText('Networking content')).toBeNull();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Networking' }));

        expect(screen.queryByText('General content')).toBeNull();
        expect(screen.getByText('Networking content')).toBeTruthy();
    });
});
