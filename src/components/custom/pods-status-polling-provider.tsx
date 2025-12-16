'use client'

import { useEffect } from 'react';
import { podsStatusPollingService } from '@/frontend/services/pods-status-polling.service';

/**
 * Client component that initializes and manages the pods status polling service.
 * This component should be mounted in the root layout to ensure polling is active
 * across all pages of the application.
 */
export default function PodsStatusPollingProvider() {
    useEffect(() => {
        podsStatusPollingService.start();

        return () => {
            podsStatusPollingService.stop();
        };
    }, []);

    return null;
}
