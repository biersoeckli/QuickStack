import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './use-polling';

describe('usePolling', () => {
    let hidden = false;

    beforeEach(() => {
        vi.useFakeTimers();
        hidden = false;
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => hidden,
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('runs the callback on every interval', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        renderHook(() => usePolling(callback, { intervalMs: 1000 }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('pauses while the document is hidden and resumes when visible again', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        renderHook(() => usePolling(callback, { intervalMs: 1000 }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(callback).toHaveBeenCalledTimes(1);

        hidden = true;
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(callback).toHaveBeenCalledTimes(1);

        hidden = false;
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('runs immediately when runImmediately is set and keeps polling', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        renderHook(() => usePolling(callback, { intervalMs: 1000, runImmediately: true }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(callback).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('schedules no timer and never runs while disabled', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        renderHook(() => usePolling(callback, { intervalMs: 1000, enabled: false, runImmediately: true }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(callback).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the timer and listener on unmount', async () => {
        const callback = vi.fn().mockResolvedValue(undefined);
        const { unmount } = renderHook(() => usePolling(callback, { intervalMs: 1000 }));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(callback).toHaveBeenCalledTimes(1);

        unmount();

        expect(vi.getTimerCount()).toBe(0);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
