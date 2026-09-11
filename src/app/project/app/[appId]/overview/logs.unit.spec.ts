import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Logs from './logs';
import { getPodsForApp } from './actions';
import { usePodsStatus } from '@/frontend/states/zustand.states';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';

vi.mock('./actions', () => ({
    getPodsForApp: vi.fn(),
}));

vi.mock('../../../../../components/custom/logs-streamed', () => ({ default: () => null }));
vi.mock('./terminal-overlay', () => ({ TerminalDialog: () => null }));
vi.mock('./logs-download-overlay', () => ({ LogsDownloadOverlay: () => null }));
vi.mock('@/components/custom/logs-overlay', () => ({ LogsDialogContent: () => null }));

const mockedGetPodsForApp = vi.mocked(getPodsForApp);

const app = { id: 'app-1', projectId: 'project-1' } as any;

function changedStatus() {
    return { appId: 'app-1' } as any;
}

describe('Logs polling lifecycle', () => {
    let hidden = false;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        hidden = false;
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => hidden,
        });
        mockedGetPodsForApp.mockResolvedValue({ status: 'success', data: [] } as any);
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('clears the scheduled status-change refreshes on unmount', async () => {
        const { unmount } = render(React.createElement(Logs, { app, role: RolePermissionEnum.READ }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const initialCalls = mockedGetPodsForApp.mock.calls.length;

        act(() => {
            usePodsStatus.getState().updatePodStatus(changedStatus());
        });
        expect(vi.getTimerCount()).toBe(2);

        unmount();
        expect(vi.getTimerCount()).toBe(0);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(15000);
        });
        expect(mockedGetPodsForApp).toHaveBeenCalledTimes(initialCalls);
    });

    it('does not schedule a refresh while the document is hidden', async () => {
        render(React.createElement(Logs, { app, role: RolePermissionEnum.READ }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        hidden = true;
        act(() => {
            usePodsStatus.getState().updatePodStatus(changedStatus());
        });

        expect(vi.getTimerCount()).toBe(0);
    });

    it('clears pending refreshes when hidden and resumes when visible again', async () => {
        render(React.createElement(Logs, { app, role: RolePermissionEnum.READ }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const initialCalls = mockedGetPodsForApp.mock.calls.length;

        act(() => {
            usePodsStatus.getState().updatePodStatus(changedStatus());
        });
        expect(vi.getTimerCount()).toBe(2);

        hidden = true;
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(vi.getTimerCount()).toBe(0);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(15000);
        });
        expect(mockedGetPodsForApp).toHaveBeenCalledTimes(initialCalls);

        hidden = false;
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(mockedGetPodsForApp).toHaveBeenCalledTimes(initialCalls + 1);
    });
});
