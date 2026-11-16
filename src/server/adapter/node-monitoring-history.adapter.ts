import { Prisma } from '@prisma/client';
import dataAccess from './db.client';

class NodeMonitoringHistoryAdapter {
  async save(samples: Prisma.NodeMonitoringSampleCreateManyInput[], cutoff: Date) {
    await dataAccess.client.$transaction(async (tx) => {
      for (let i = 0; i < samples.length; i += 100) await tx.nodeMonitoringSample.createMany({ data: samples.slice(i, i + 100) });
      await tx.nodeMonitoringSample.deleteMany({ where: { sampledAt: { lt: cutoff } } });
    });
  }

  async getHistory(cutoff: Date) {
    return dataAccess.client.nodeMonitoringSample.findMany({ where: { sampledAt: { gte: cutoff } }, orderBy: { sampledAt: 'asc' } });
  }
}
export default new NodeMonitoringHistoryAdapter();
