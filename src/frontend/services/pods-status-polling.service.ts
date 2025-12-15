import { getAllPodsStatus } from '@/app/api/deployment-status/actions';
import { usePodsStatus } from '../states/zustand.states';

/**
 * Singleton service that manages polling for all pods status.
 * This service runs in the browser and updates the Zustand store with fresh data.
 */
class PodsStatusPollingService {
    private static instance: PodsStatusPollingService;
    private intervalId: NodeJS.Timeout | null = null;
    private isPolling = false;
    private readonly POLL_INTERVAL_MS = 20000;

    private constructor() { }

    public static getInstance(): PodsStatusPollingService {
        if (!PodsStatusPollingService.instance) {
            PodsStatusPollingService.instance = new PodsStatusPollingService();
        }
        return PodsStatusPollingService.instance;
    }

    public start(): void {
        if (this.isPolling) {
            console.log('[PodsStatusPolling] Already polling, skipping start');
            return;
        }

        console.log('[PodsStatusPolling] Starting pod status polling');
        this.isPolling = true;

        // Fetch immediately on start
        this.fetchPodsStatus();

        this.intervalId = setInterval(() => {
            this.fetchPodsStatus();
        }, this.POLL_INTERVAL_MS);
    }

    public stop(): void {
        if (this.intervalId) {
            console.log('[PodsStatusPolling] Stopping pod status polling');
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isPolling = false;
        }
    }

    private async fetchPodsStatus(): Promise<void> {
        try {
            const { setPodsStatus } = usePodsStatus.getState();

            const response = await getAllPodsStatus();

            if (response.status === 'success' && response.data) {
                console.log('Polles status', response.data)
                setPodsStatus(response.data);
            } else {
                console.error('[PodsStatusPolling] Failed to fetch pods status:', response.message);
            }
        } catch (error) {
            console.error('[PodsStatusPolling] Error fetching pods status:', error);
        }
    }

    public async refresh(): Promise<void> {
        await this.fetchPodsStatus();
    }

    public isActive(): boolean {
        return this.isPolling;
    }
}

export const podsStatusPollingService = PodsStatusPollingService.getInstance();
