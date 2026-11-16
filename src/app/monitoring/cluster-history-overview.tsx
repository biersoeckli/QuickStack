'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMonitoringRangeOptions } from '@/components/custom/app-monitoring-history';
import { usePolling } from '@/frontend/hooks/use-polling';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { NodeResourceModel } from '@/shared/model/node-resource.model';
import { getNodeResourceUsage } from './actions';
import NodeMonitoringHistory from './node-monitoring-history';

export default function ClusterHistoryOverview() {
  const [nodes, setNodes] = useState<NodeResourceModel[]>();
  const [nodesLoading, setNodesLoading] = useState(true);
  const [range, setRange] = useState('24h');
  const [retentionHours, setRetentionHours] = useState(1);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('monitoring-cluster-history-range');
      if (saved && ['1h', '5h', 'today', '24h', '48h', '7d', 'all'].includes(saved)) {
        setRange(saved);
      }
    } catch {
      /* Storage may be unavailable. */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setNodes(await Actions.run(() => getNodeResourceUsage()));
    } catch (error) {
      console.error('Unable to load current node usage', error);
    } finally {
      setNodesLoading(false);
    }
  }, []);
  usePolling(refresh, { intervalMs: 10_000, runImmediately: true });

  const options = getMonitoringRangeOptions(retentionHours);
  const selected = options.find((option) => option.value === range) ?? options[0];

  return (
    <section className="flex flex-col gap-4" aria-label="Cluster history">
      <NodeMonitoringHistory selectedRange={selected} onRetentionHoursChange={setRetentionHours} nodes={nodes} nodesLoading={nodesLoading} />
    </section>
  );
}
