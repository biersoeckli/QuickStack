import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonitoringTab from './monitoring-app';
import { getRessourceDataApp } from './actions';

vi.mock('./actions', () => ({
    getRessourceDataApp: vi.fn(),
}));

const mockedGetRessourceDataApp = vi.mocked(getRessourceDataApp);

const app = { id: 'app-1', projectId: 'project-1' } as any;

function successResponse() {
    return {
        status: 'success',
        data: { cpuPercent: 1, cpuAbsolutCores: 0.5, ramPercent: 10, ramAbsolutBytes: 1024 },
    } as any;
}

describe('MonitoringTab polling lifecycle', () => {
    let hidden = false;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        hidden = false;
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => hidden,
        });
        mockedGetRessourceDataApp.mockResolvedValue(successResponse());
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('runs the first fetch immediately and keeps polling on the interval', async () => {
        render(React.createElement(MonitoringTab, { app }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(mockedGetRessourceDataApp).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });
        expect(mockedGetRessourceDataApp).toHaveBeenCalledTimes(2);
    });

    it('pauses while the document is hidden and leaves no timer behind on unmount', async () => {
        const { unmount } = render(React.createElement(MonitoringTab, { app }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(mockedGetRessourceDataApp).toHaveBeenCalledTimes(1);

        hidden = true;
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30000);
        });
        expect(mockedGetRessourceDataApp).toHaveBeenCalledTimes(1);

        unmount();
        expect(vi.getTimerCount()).toBe(0);

        hidden = false;
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30000);
        });
        expect(mockedGetRessourceDataApp).toHaveBeenCalledTimes(1);
    });
});
