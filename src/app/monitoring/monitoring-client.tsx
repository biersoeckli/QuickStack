'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { usePolling } from '@/frontend/hooks/use-polling';
import { AppMonitoringUsageModel } from '@/shared/model/app-monitoring-usage.model';
import { AppVolumeMonitoringUsageModel } from '@/shared/model/app-volume-monitoring-usage.model';
import { NodeResourceModel } from '@/shared/model/node-resource.model';
import { getMonitoringForAllApps, getNodeResourceUsage, getVolumeMonitoringUsage } from './actions';
import AppRessourceMonitoring from './app-monitoring';
import AppVolumeMonitoring from './app-volumes-monitoring';
import ResourcesNodes from './monitoring-nodes';

const MONITORING_POLL_INTERVAL_MS = 10000;

/**
 * Single polling owner for the monitoring page. It refreshes nodes, apps and
 * volumes in one batched request and hands the data to the presentational cards,
 * so the page runs one pausable poller instead of three independent intervals.
 */
export default function MonitoringClient({
    resourcesNodes,
    appsRessourceUsage,
    volumesUsage,
}: {
    resourcesNodes?: NodeResourceModel[];
    appsRessourceUsage?: AppMonitoringUsageModel[];
    volumesUsage?: AppVolumeMonitoringUsageModel[];
}) {

    const [updatedNodes, setUpdatedNodes] = useState(resourcesNodes);
    const [updatedApps, setUpdatedApps] = useState(appsRessourceUsage);
    const [updatedVolumes, setUpdatedVolumes] = useState(volumesUsage);

    const refreshMonitoringData = useCallback(async () => {
        try {
            const [nodes, volumes, apps] = await Promise.all([
                Actions.run(() => getNodeResourceUsage()),
                Actions.run(() => getVolumeMonitoringUsage()),
                Actions.run(() => getMonitoringForAllApps()),
            ]);
            setUpdatedNodes(nodes);
            setUpdatedVolumes(volumes?.filter((volume) => !!volume.isBaseVolume));
            setUpdatedApps(apps);
        } catch (ex) {
            toast.error('An error occurred while fetching current resource usage');
            console.error('An error occurred while fetching monitoring data', ex);
        }
    }, []);

    usePolling(refreshMonitoringData, { intervalMs: MONITORING_POLL_INTERVAL_MS });

    return (
        <div className="space-y-6">
            <ResourcesNodes resourcesNodes={updatedNodes} />
            <AppRessourceMonitoring appsRessourceUsage={updatedApps} />
            <AppVolumeMonitoring volumesUsage={updatedVolumes} />
        </div>
    );
}
