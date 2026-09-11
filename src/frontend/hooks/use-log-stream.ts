'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Constants } from '@/shared/utils/constants';
import { StreamUtils } from '@/shared/utils/stream.utils';

export interface LogStreamResult {
    logs: string;
    isConnected: boolean;
    textAreaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Streams server-sent event log data into a bounded, throttled string.
 *
 * Incoming chunks are framed with the shared SSE parser, appends are batched
 * per animation frame to avoid a re-render per network chunk, and the retained
 * text is capped to the last `maxLines` lines so memory stays stable.
 */
export function useLogStream(
    url: string,
    body: string,
    enabled: boolean,
    maxLines: number = Constants.DEFAULT_MAX_LOG_LINES,
): LogStreamResult {
    const [logs, setLogs] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const controller = new AbortController();
        let isActive = true;
        let buffer = '';
        let pending = '';
        let animationFrame: number | null = null;

        const flushPending = () => {
            animationFrame = null;
            if (!isActive || pending.length === 0) {
                return;
            }

            const addition = pending;
            pending = '';
            setLogs(previous => StreamUtils.capLines(previous + addition, maxLines));
        };

        const scheduleFlush = () => {
            if (animationFrame === null) {
                animationFrame = requestAnimationFrame(flushPending);
            }
        };

        const connect = async () => {
            setLogs('Loading...');

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/event-stream',
                    },
                    body,
                    signal: controller.signal,
                });

                if (!response.ok || !response.body) {
                    return;
                }

                setIsConnected(true);
                setLogs('');
                buffer = '';

                const reader = response.body
                    .pipeThrough(new TextDecoderStream())
                    .getReader();

                while (isActive) {
                    const { value, done } = await reader.read();
                    if (done) {
                        break;
                    }
                    if (!value) {
                        continue;
                    }

                    const parsed = StreamUtils.parseSseFrames(buffer, value);
                    buffer = parsed.buffer;

                    for (const frame of parsed.frames) {
                        pending += decodeLogFrame(frame);
                    }

                    if (pending.length > 0) {
                        scheduleFlush();
                    }
                }
            } catch (error) {
                if (!isAbortError(error)) {
                    console.error('[useLogStream] Stream error:', error);
                }
            } finally {
                if (isActive) {
                    flushPending();
                    setIsConnected(false);
                }
            }
        };

        void connect();

        return () => {
            isActive = false;
            controller.abort();
            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
        };
    }, [url, body, enabled, maxLines]);

    useEffect(() => {
        const textArea = textAreaRef.current;
        if (textArea) {
            textArea.scrollTop = textArea.scrollHeight;
        }
    }, [logs]);

    return { logs, isConnected, textAreaRef };
}

function decodeLogFrame(frame: string): string {
    try {
        const decoded: unknown = JSON.parse(frame);
        return typeof decoded === 'string' ? decoded : frame;
    } catch {
        return frame;
    }
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}
