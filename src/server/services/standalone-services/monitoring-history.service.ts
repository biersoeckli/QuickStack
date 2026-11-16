import { Prisma } from '@prisma/client';
import dataAccess from '@/server/adapter/db.client';
import { Constants } from '@/shared/utils/constants';
import { ListUtils } from '@/shared/utils/list.utils';

class MonitoringHistoryService {
  async getRetentionHours() {
    const value = (await dataAccess.client.parameter.findUnique({ where: { name: Constants.APP_MONITORING_HISTORY_RETENTION_HOURS } }))?.value;
    const hours = Number(value);
    return Number.isInteger(hours) && hours >= 1 && hours <= 168 ? hours : 24;
  }

  async setRetentionHours(hours: number) {
    await dataAccess.client.parameter.upsert({
      where: { name: Constants.APP_MONITORING_HISTORY_RETENTION_HOURS },
      create: { name: Constants.APP_MONITORING_HISTORY_RETENTION_HOURS, value: String(hours) },
      update: { value: String(hours) }
    });
  }

  async saveSamples(tx: Prisma.TransactionClient, samples: Prisma.MonitoringSampleCreateManyInput[], cutoff: Date) {
    for (const chunk of ListUtils.chunk(samples, 100)) await tx.monitoringSample.createMany({ data: chunk });
    await tx.monitoringSample.deleteMany({ where: { sampledAt: { lt: cutoff } } });
  }
}
export default new MonitoringHistoryService();
