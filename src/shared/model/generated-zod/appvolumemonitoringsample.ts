import * as z from 'zod';

import { CompleteAppVolume, RelatedAppVolumeModel, CompleteAppVolumeMonitoringMembership, RelatedAppVolumeMonitoringMembershipModel } from './index';

export const AppVolumeMonitoringSampleModel = z.object({
  id: z.string(),
  sampledAt: z.date(),
  volumeId: z.string(),
  status: z.string(),
  usedBytes: z.number().nullish(),
  availableBytes: z.number().nullish(),
  capacityBytes: z.number().nullish(),
  measuredAt: z.date().nullish()
});

export interface CompleteAppVolumeMonitoringSample extends z.infer<typeof AppVolumeMonitoringSampleModel> {
  volume: CompleteAppVolume;
  memberships: CompleteAppVolumeMonitoringMembership[];
}

/**
 * RelatedAppVolumeMonitoringSampleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppVolumeMonitoringSampleModel: z.ZodSchema<CompleteAppVolumeMonitoringSample> = z.lazy(() =>
  AppVolumeMonitoringSampleModel.extend({ volume: RelatedAppVolumeModel, memberships: RelatedAppVolumeMonitoringMembershipModel.array() })
);
