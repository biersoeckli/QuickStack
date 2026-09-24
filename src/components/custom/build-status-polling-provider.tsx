'use client'

import { useEffect } from 'react';
import { buildStatusPollingService } from '@/frontend/services/build-status-sse.service';

/**
 * Client component that initializes and manages the build status streaming service.
 * Mounted in the root layout so the build status of all apps stays fresh.
 */
export default function BuildStatusPollingProvider() {
    useEffect(() => {
        buildStatusPollingService.start();

        return () => {
            buildStatusPollingService.stop();
        };
    }, []);

    return null;
}
