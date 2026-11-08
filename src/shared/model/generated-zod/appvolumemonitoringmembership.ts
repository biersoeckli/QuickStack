import * as z from 'zod';

import { CompleteAppVolumeMonitoringSample, RelatedAppVolumeMonitoringSampleModel, CompleteAppVolume, RelatedAppVolumeModel } from './index';

export const AppVolumeMonitoringMembershipModel = z.object({ sampleId: z.string(), volumeId: z.string() });

export interface CompleteAppVolumeMonitoringMembership extends z.infer<typeof AppVolumeMonitoringMembershipModel> {
  sample: CompleteAppVolumeMonitoringSample;
  volume: CompleteAppVolume;
}

/**
 * RelatedAppVolumeMonitoringMembershipModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppVolumeMonitoringMembershipModel: z.ZodSchema<CompleteAppVolumeMonitoringMembership> = z.lazy(() =>
  AppVolumeMonitoringMembershipModel.extend({ sample: RelatedAppVolumeMonitoringSampleModel, volume: RelatedAppVolumeModel })
);
