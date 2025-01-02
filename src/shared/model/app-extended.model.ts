import { z } from "zod";
import { AppDomainModel, AppFileMountModel, AppModel, AppPortModel, AppVolumeModel, ProjectModel, VolumeBackupModel } from "./generated-zod";

export const AppExtendedZodModel= z.lazy(() => AppModel.extend({
    project: ProjectModel,
    appDomains: AppDomainModel.array(),
    appPorts: AppPortModel.array(),
    appFileMounts: AppFileMountModel.array(),
    appVolumes: AppVolumeModel.array(),
  }))

export type AppExtendedModel = z.infer<typeof AppExtendedZodModel>;
