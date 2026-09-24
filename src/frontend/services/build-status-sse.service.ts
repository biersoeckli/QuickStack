import { AppBuildStatusModel } from '@/shared/model/app-build-status.model';
import { StreamUtils } from '@/shared/utils/stream.utils';
import { useBuildStatus } from '../states/zustand.states';

/**
 * Singleton service that manages streaming for the build status of all apps.
 * This service runs in the browser and updates the Zustand store with fresh data via SSE.
 */
class BuildStatusSSEStateService {
    private static instance: BuildStatusSSEStateService;
    private controller: AbortController | null = null;
    private isConnected = false;
    private buffer = '';

    private constructor() { }

    public static getInstance(): BuildStatusSSEStateService {
        if (!BuildStatusSSEStateService.instance) {
            BuildStatusSSEStateService.instance = new BuildStatusSSEStateService();
        }
        return BuildStatusSSEStateService.instance;
    }

    public start(): void {
        if (this.isConnected) {
            console.log('[BuildStatusService] Already connected, skipping start');
            return;
        }

        console.log('[BuildStatusService] Starting build status stream');
        this.connect();
    }

    public stop(): void {
        if (this.controller) {
            console.log('[BuildStatusService] Stopping build status stream');
            this.controller.abort();
            this.controller = null;
            this.isConnected = false;
            this.buffer = '';
        }
    }

    private async connect() {
        const controller = new AbortController();
        this.controller = controller;
        const signal = controller.signal;
        this.isConnected = true;
        this.buffer = '';

        try {
            const response = await fetch('/api/build-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: signal,
            });

            if (!response.ok || !response.body) {
                throw new Error('Failed to connect to build status stream');
            }

            const reader = response.body
                .pipeThrough(new TextDecoderStream())
                .getReader();

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    this.reconnect(controller);
                    break;
                }
                if (value) {
                    this.processChunk(value);
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('[BuildStatusService] Stream aborted');
            } else {
                console.error('[BuildStatusService] Stream error:', error);
                this.reconnect(controller);
            }
        } finally {
            if (this.controller === controller) {
                this.isConnected = false;
            }
        }
    }

    private reconnect(controller: AbortController): void {
        this.isConnected = false;
        setTimeout(() => {
            if (this.controller === controller && !controller.signal.aborted) {
                this.connect();
            }
        }, 5000);
    }

    private processChunk(chunk: string) {
        const { frames, buffer } = StreamUtils.parseSseFrames(this.buffer, chunk);
        this.buffer = buffer;

        for (const frame of frames) {
            try {
                const data = JSON.parse(frame);
                const { setBuildStatus, updateBuildStatus } = useBuildStatus.getState();

                if (Array.isArray(data)) {
                    setBuildStatus(data as AppBuildStatusModel[]);
                } else {
                    updateBuildStatus(data as AppBuildStatusModel);
                }
            } catch (e) {
                console.error('[BuildStatusService] Error parsing JSON:', e);
            }
        }
    }

    public refresh(): void {
        this.stop();
        this.start();
    }

    public isActive(): boolean {
        return this.isConnected;
    }
}

export const buildStatusPollingService = BuildStatusSSEStateService.getInstance();
