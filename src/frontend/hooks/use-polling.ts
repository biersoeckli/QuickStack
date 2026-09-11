'use client';

import { useEffect, useRef } from 'react';

export interface UsePollingOptions {
    /**
     * Delay between two poll runs in milliseconds.
     */
    intervalMs: number;
    /**
     * When false the poller stays idle and clears any pending timer.
     */
    enabled?: boolean;
    /**
     * Run the callback immediately on mount instead of waiting for the first interval.
     */
    runImmediately?: boolean;
}

/**
 * Visibility-aware polling hook.
 *
 * Runs `callback` repeatedly with `intervalMs` between executions, pauses while
 * the browser tab is hidden, resumes (with an immediate run) when it becomes
 * visible again, and always clears its timer and listener on unmount. Runs never
 * overlap: the next timer is only scheduled after the previous callback settles.
 */
export function usePolling(
    callback: () => void | Promise<void>,
    { intervalMs, enabled = true, runImmediately = false }: UsePollingOptions,
): void {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled || intervalMs <= 0) {
            return;
        }

        let isActive = true;
        let isPolling = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const clearTimer = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        const isHidden = () => typeof document !== 'undefined' && document.hidden;

        const scheduleNext = () => {
            clearTimer();
            if (!isActive || isHidden()) {
                return;
            }
            timeoutId = setTimeout(runPoll, intervalMs);
        };

        const runPoll = async () => {
            if (!isActive || isHidden() || isPolling) {
                return;
            }
            isPolling = true;
            try {
                await callbackRef.current();
            } catch (error) {
                console.error('[usePolling] Polling callback failed:', error);
            } finally {
                isPolling = false;
                scheduleNext();
            }
        };

        const handleVisibilityChange = () => {
            if (isHidden()) {
                clearTimer();
            } else {
                void runPoll();
            }
        };

        if (runImmediately) {
            void runPoll();
        } else {
            scheduleNext();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isActive = false;
            clearTimer();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, intervalMs, runImmediately]);
}
