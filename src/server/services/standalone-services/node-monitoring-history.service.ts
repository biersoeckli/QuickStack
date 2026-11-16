import { MonitoringHistoryUtils } from '@/shared/utils/monitoring-history.utils';
import nodeResourceService from './node-resource.service';
import scheduleService from './schedule.service';
import dataAccess from '@/server/adapter/db.client';
import { Prisma } from '@prisma/client';
import monitoringHistoryService from './monitoring-history.service';
import { NodeMonitoringHistoryUtils } from '@/shared/utils/node-monitoring-history.utils';

class NodeMonitoringHistoryService {
  private running = false;

  initialize() {
    scheduleService.scheduleJob('node-monitoring-history', `*/${MonitoringHistoryUtils.COLLECTION_INTERVAL_MINUTES} * * * *`, () => {
      void this.collectScheduled();
    });
    void this.collectScheduled();
  }

  private async collectScheduled() {
    if (this.running) return;
    this.running = true;
    try {
      const retention = await monitoringHistoryService.getRetentionHours();
      await this.collect(new Date(), retention);
    } catch (error) {
      console.error('Node monitoring history collection failed', error);
    } finally {
      this.running = false;
    }
  }

  async save(samples: Prisma.MonitoringSampleCreateManyInput[], cutoff: Date) {
    await dataAccess.client.$transaction((tx) => monitoringHistoryService.saveSamples(tx, samples, cutoff));
  }

  async collect(sampledAt: Date, retentionHours: number) {
    const nodes = await nodeResourceService.getNodeResourceUsage();
    await this.save(
      nodes.map((node) => ({
        sampledAt,
        nodeName: node.name,
        cpuCores: node.cpuUsage,
        ramBytes: node.ramUsage,
        nodeFilesystemUsedBytes: node.diskUsageAbsolut ?? null,
        measuredAt: node.measuredAt ?? null
      })),
      new Date(sampledAt.getTime() - retentionHours * 3600_000)
    );
  }

  async getHistory() {
    const retentionHours = await monitoringHistoryService.getRetentionHours();
    const samples = await dataAccess.client.monitoringSample.findMany({
      where: { nodeName: { not: null }, sampledAt: { gte: new Date(Date.now() - retentionHours * 3600_000) } },
      orderBy: { sampledAt: 'asc' }
    });
    const points = samples.map((sample) => ({ ...sample, diskBytes: sample.nodeFilesystemUsedBytes }));
    return { retentionHours, points: NodeMonitoringHistoryUtils.aggregate(points) };
  }
}
export default new NodeMonitoringHistoryService();
