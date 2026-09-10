import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppPodsStatusModel } from '@/shared/model/app-pod-status.model';
import { usePodsStatus } from '@/frontend/states/zustand.states';
import PodStatusIndicator from './pod-status-indicator';

vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
    TooltipContent: ({ children }: { children: React.ReactNode }) => children,
}));

function status(appId: string, deploymentStatus: AppPodsStatusModel['deploymentStatus']): AppPodsStatusModel {
    return {
        appId,
        appName: appId,
        projectId: 'project-1',
        projectName: 'Project 1',
        replicas: 1,
        readyReplicas: 1,
        deploymentStatus,
    };
}

describe('PodStatusIndicator render isolation', () => {
    beforeEach(() => {
        usePodsStatus.setState({
            podsStatus: new Map([
                ['app-a', status('app-a', 'DEPLOYED')],
                ['app-b', status('app-b', 'DEPLOYED')],
            ]),
            lastUpdate: null,
            isLoading: false,
            listeners: new Set(),
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('does not re-render app B when only app A status changes', () => {
        const renders = { a: 0, b: 0 };
        render(React.createElement(
            React.Fragment,
            null,
            React.createElement(
                React.Profiler,
                { id: 'app-a', onRender: () => { renders.a++; } },
                React.createElement(PodStatusIndicator, { appId: 'app-a' }),
            ),
            React.createElement(
                React.Profiler,
                { id: 'app-b', onRender: () => { renders.b++; } },
                React.createElement(PodStatusIndicator, { appId: 'app-b' }),
            ),
        ));

        const initialA = renders.a;
        const initialB = renders.b;

        act(() => {
            usePodsStatus.getState().updatePodStatus(status('app-a', 'ERROR'));
        });

        expect(renders.a).toBeGreaterThan(initialA);
        expect(renders.b).toBe(initialB);
    });
});
