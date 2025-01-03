import { z } from "zod";
import { AppDomainModel, AppModel, AppPortModel, AppVolumeModel, ProjectModel, RelatedAppModel } from "./generated-zod";


export const AppExtendedZodModel= z.lazy(() => AppModel.extend({
    project: ProjectModel,
    appDomains: AppDomainModel.array(),
    appVolumes: AppVolumeModel.array(),
    appPorts: AppPortModel.array(),
  }))

export type AppExtendedModel = z.infer<typeof AppExtendedZodModel>;