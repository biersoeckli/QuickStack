import { MonitoringHistoryUtils } from '@/shared/utils/monitoring-history.utils';
import nodeResourceService from './node-resource.service';
import scheduleService from './schedule.service';
import nodeHistoryAdapter from '@/server/adapter/node-monitoring-history.adapter';
import appHistoryAdapter from '@/server/adapter/app-history.adapter';
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
      const retention = await appHistoryAdapter.getRetentionHours();
      await this.collect(new Date(), retention);
    } catch (error) {
      console.error('Node monitoring history collection failed', error);
    } finally {
      this.running = false;
    }
  }

  async collect(sampledAt: Date, retentionHours: number) {
    const nodes = await nodeResourceService.getNodeResourceUsage();
    await nodeHistoryAdapter.save(
      nodes.map((node) => ({ sampledAt, nodeName: node.name, cpuCores: node.cpuUsage, ramBytes: node.ramUsage, diskBytes: node.diskUsageAbsolut ?? null })),
      new Date(sampledAt.getTime() - retentionHours * 3600_000)
    );
  }

  async getHistory() {
    const retentionHours = await appHistoryAdapter.getRetentionHours();
    const samples = await nodeHistoryAdapter.getHistory(new Date(Date.now() - retentionHours * 3600_000));
    return { retentionHours, points: NodeMonitoringHistoryUtils.aggregate(samples) };
  }
}
export default new NodeMonitoringHistoryService();
