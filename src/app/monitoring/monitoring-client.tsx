'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChartLine, ChartPie, Cpu, HardDrive } from 'lucide-react';
import { getMonitoringRangeOptions } from '@/components/custom/app-monitoring-history';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Actions } from '@/frontend/utils/nextjs-actions.utils';
import { usePolling } from '@/frontend/hooks/use-polling';
import { AppMonitoringUsageModel } from '@/shared/model/app-monitoring-usage.model';
import { AppVolumeMonitoringUsageModel } from '@/shared/model/app-volume-monitoring-usage.model';
import { NodeResourceModel } from '@/shared/model/node-resource.model';
import { getMonitoringForAllApps, getNodeResourceUsage, getReservedVolumeStorage, getVolumeMonitoringUsage } from './actions';
import AppRessourceMonitoring from './app-monitoring';
import AppVolumeMonitoring from './app-volumes-monitoring';
import ResourcesNodes from './monitoring-nodes';
import NodeMonitoringHistory from './node-monitoring-history';

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
  reservedVolumeStorage
}: {
  resourcesNodes?: NodeResourceModel[];
  appsRessourceUsage?: AppMonitoringUsageModel[];
  volumesUsage?: AppVolumeMonitoringUsageModel[];
  reservedVolumeStorage?: number;
}) {
  const [view, setView] = useState('history');
  const [range, setRange] = useState('24h');
  const [retentionHours, setRetentionHours] = useState(1);

  useEffect(() => {
    try {
      const savedRange = window.localStorage.getItem('monitoring-cluster-history-range');
      if (savedRange && ['1h', '5h', 'today', '24h', '48h', '7d', 'all'].includes(savedRange)) {
        setRange(savedRange);
      }
      const saved = window.localStorage.getItem('monitoring-cluster-view');
      if (saved === 'current' || saved === 'history') {
        setView(saved);
      }
    } catch {
      /* Storage may be unavailable. */
    }
  }, []);

  const [updatedReservedStorage, setUpdatedReservedStorage] = useState(reservedVolumeStorage);
  const [updatedNodes, setUpdatedNodes] = useState(resourcesNodes);
  const [updatedApps, setUpdatedApps] = useState(appsRessourceUsage);
  const [updatedVolumes, setUpdatedVolumes] = useState(volumesUsage);

  const refreshMonitoringData = useCallback(async () => {
    try {
      const [nodes, volumes, apps, reservedStorage] = await Promise.all([
        Actions.run(() => getNodeResourceUsage()),
        Actions.run(() => getVolumeMonitoringUsage()),
        Actions.run(() => getMonitoringForAllApps()),
        Actions.run(() => getReservedVolumeStorage()).catch(() => undefined)
      ]);
      setUpdatedNodes(nodes);
      setUpdatedReservedStorage(reservedStorage);
      setUpdatedVolumes(volumes?.filter((volume) => !!volume.isBaseVolume));
      setUpdatedApps(apps);
    } catch (ex) {
      toast.error('An error occurred while fetching current resource usage');
      console.error('An error occurred while fetching monitoring data', ex);
    }
  }, []);

  usePolling(refreshMonitoringData, { intervalMs: MONITORING_POLL_INTERVAL_MS });

  const options = getMonitoringRangeOptions(retentionHours);
  const selected = options.find((option) => option.value === range) ?? options[0];

  return (
    <div className="space-y-6">
      <Tabs
        value={view}
        onValueChange={(value) => {
          if (value !== 'current' && value !== 'history') {
            return;
          }
          setView(value);
          try {
            window.localStorage.setItem('monitoring-cluster-view', value);
          } catch {
            /* Storage may be unavailable. */
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="history" aria-label="Cluster history" title="Cluster history">
              <ChartLine />
            </TabsTrigger>
            <TabsTrigger value="current" aria-label="Current usage" title="Current usage">
              <ChartPie />
            </TabsTrigger>
          </TabsList>
          {view === 'history' && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select
                value={selected.value}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }
                  setRange(value);
                  try {
                    window.localStorage.setItem('monitoring-cluster-history-range', value);
                  } catch {
                    /* Storage may be unavailable. */
                  }
                }}
              >
                <SelectTrigger aria-label="History time range">
                  <SelectValue>{selected.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <TabsContent value="current">
          <ResourcesNodes resourcesNodes={updatedNodes} reservedVolumeStorage={updatedReservedStorage} section="charts" />
        </TabsContent>
        <TabsContent value="history">
          <NodeMonitoringHistory selectedRange={selected} onRetentionHoursChange={setRetentionHours} nodes={updatedNodes} />
        </TabsContent>
      </Tabs>
      <ResourcesNodes resourcesNodes={updatedNodes} reservedVolumeStorage={updatedReservedStorage} section="table" />
      <Tabs defaultValue="resources">
        <TabsList>
          <TabsTrigger value="resources">
            <Cpu data-icon="inline-start" />
            App Resource Usage
          </TabsTrigger>
          <TabsTrigger value="volumes">
            <HardDrive data-icon="inline-start" />
            App Volumes Capacity
          </TabsTrigger>
        </TabsList>
        <TabsContent value="resources" className="pt-1">
          <AppRessourceMonitoring appsRessourceUsage={updatedApps} />
        </TabsContent>
        <TabsContent value="volumes" className="pt-1">
          <AppVolumeMonitoring volumesUsage={updatedVolumes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
