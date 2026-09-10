import { AppPodsStatusModel } from '@/shared/model/app-pod-status.model';
import { StreamUtils } from '@/shared/utils/stream.utils';
import { usePodsStatus } from '../states/zustand.states';

/**
 * Singleton service that manages streaming for all pods status.
 * This service runs in the browser and updates the Zustand store with fresh data via SSE.
 */
class PodsStatusPollingService {
    private static instance: PodsStatusPollingService;
    private controller: AbortController | null = null;
    private isConnected = false;
    private buffer = '';

    private constructor() { }

    public static getInstance(): PodsStatusPollingService {
        if (!PodsStatusPollingService.instance) {
            PodsStatusPollingService.instance = new PodsStatusPollingService();
        }
        return PodsStatusPollingService.instance;
    }

    public start(): void {
        if (this.isConnected) {
            console.log('[PodsStatusService] Already connected, skipping start');
            return;
        }

        console.log('[PodsStatusService] Starting pod status stream');
        this.connect();
    }

    public stop(): void {
        if (this.controller) {
            console.log('[PodsStatusService] Stopping pod status stream');
            this.controller.abort();
            this.controller = null;
            this.isConnected = false;
            this.buffer = '';
        }
    }

    private async connect() {
        this.controller = new AbortController();
        const signal = this.controller.signal;
        this.isConnected = true;
        this.buffer = '';

        try {
            const response = await fetch('/api/deployment-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: signal,
            });

            if (!response.ok || !response.body) {
                throw new Error('Failed to connect to deployment status stream');
            }

            const reader = response.body
                .pipeThrough(new TextDecoderStream())
                .getReader();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    this.processChunk(value);
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('[PodsStatusService] Stream aborted');
            } else {
                console.error('[PodsStatusService] Stream error:', error);
                // Retry logic
                this.isConnected = false;
                setTimeout(() => {
                    if (!signal.aborted) {
                        this.connect();
                    }
                }, 5000);
            }
        } finally {
            this.isConnected = false;
        }
    }

    private processChunk(chunk: string) {
        // Frames are buffered so an incomplete frame split across chunks is
        // carried into the next read instead of being dropped.
        const { frames, buffer } = StreamUtils.parseSseFrames(this.buffer, chunk);
        this.buffer = buffer;

        for (const frame of frames) {
            try {
                const data = JSON.parse(frame);
                const { setPodsStatus, updatePodStatus } = usePodsStatus.getState();

                if (Array.isArray(data)) {
                    setPodsStatus(data as AppPodsStatusModel[]);
                } else {
                    updatePodStatus(data as AppPodsStatusModel);
                }
            } catch (e) {
                console.error('[PodsStatusService] Error parsing JSON:', e);
            }
        }
    }

    public refresh(): void {
        // Reconnect to refresh
        this.stop();
        this.start();
    }

    public isActive(): boolean {
        return this.isConnected;
    }
}

export const podsStatusPollingService = PodsStatusPollingService.getInstance();
