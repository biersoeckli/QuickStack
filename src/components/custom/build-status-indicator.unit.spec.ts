import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppBuildStatusModel } from '@/shared/model/app-build-status.model';
import { useBuildStatus } from '@/frontend/states/zustand.states';
import { useDialog } from '@/frontend/states/zustand.states';
import BuildStatusIndicator from './build-status-indicator';

vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    TooltipTrigger: ({ children, render }: { children?: React.ReactNode; render?: React.ReactNode }) => render ?? children,
    TooltipContent: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/app/project/app/[appId]/overview/build-logs-overlay', () => ({
    BuildLogsDialogContent: () => null,
}));

function status(workloadId: string, buildStatus: AppBuildStatusModel['status']): AppBuildStatusModel {
    return {
        workloadId,
        workloadType: 'app',
        workloadName: workloadId,
        projectId: 'project-1',
        projectName: 'Project 1',
        status: buildStatus,
    };
}

describe('BuildStatusIndicator', () => {
    beforeEach(() => {
        useBuildStatus.setState({
            buildStatus: new Map(),
            lastUpdate: null,
            isLoading: false,
            listeners: new Set(),
        });
        useDialog.setState({ openDialog: vi.fn() });
    });

    afterEach(() => {
        cleanup();
    });

    it('shows a running label while a build is running', () => {
        useBuildStatus.setState({ buildStatus: new Map([['app-a', status('app-a', 'RUNNING')]]) });

        render(React.createElement(BuildStatusIndicator, { appId: 'app-a', showLabel: true }));

        expect(screen.getByText('Building')).toBeTruthy();
    });

    it('opens build logs for a running build', () => {
        const openDialog = vi.fn();
        useDialog.setState({ openDialog });
        useBuildStatus.setState({ buildStatus: new Map([['app-a', {
            ...status('app-a', 'RUNNING'),
            deploymentId: 'deployment-1',
        }]]) });

        render(React.createElement(BuildStatusIndicator, { appId: 'app-a', showLabel: true }));
        fireEvent.click(screen.getByRole('button'));

        expect(openDialog).toHaveBeenCalledOnce();
    });

    it('shows a pending label while a build is queued', () => {
        useBuildStatus.setState({ buildStatus: new Map([['app-a', status('app-a', 'PENDING')]]) });

        render(React.createElement(BuildStatusIndicator, { appId: 'app-a', showLabel: true }));

        expect(screen.getByText('Pending')).toBeTruthy();
    });

    it('shows a failed label when the last build failed', () => {
        useBuildStatus.setState({ buildStatus: new Map([['app-a', status('app-a', 'FAILED')]]) });

        render(React.createElement(BuildStatusIndicator, { appId: 'app-a', showLabel: true }));

        expect(screen.getByText('Build failed')).toBeTruthy();
    });

    it('renders nothing when the last build succeeded', () => {
        useBuildStatus.setState({ buildStatus: new Map([['app-a', status('app-a', 'SUCCEEDED')]]) });

        const { container } = render(React.createElement(BuildStatusIndicator, { appId: 'app-a', showLabel: true }));

        expect(container.textContent).toBe('');
    });

    it('renders nothing when there is no build yet', () => {
        useBuildStatus.setState({ buildStatus: new Map([['app-a', status('app-a', 'NOT_BUILT')]]) });

        const { container } = render(React.createElement(BuildStatusIndicator, { appId: 'app-a' }));

        expect(container.textContent).toBe('');
    });
});
