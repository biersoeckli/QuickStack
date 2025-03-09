import { z } from "zod";
import { AppBasicAuthModel, AppDomainModel, AppFileMountModel, AppModel, AppPortModel, AppVolumeModel, ProjectModel, VolumeBackupModel } from "./generated-zod";
import { App, Project } from "@prisma/client";

export const AppExtendedZodModel= z.lazy(() => AppModel.extend({
    project: ProjectModel,
    appDomains: AppDomainModel.array(),
    appPorts: AppPortModel.array(),
    appFileMounts: AppFileMountModel.array(),
    appVolumes: AppVolumeModel.array(),
    appBasicAuths: AppBasicAuthModel.array(),
  }))

export type AppExtendedModel = z.infer<typeof AppExtendedZodModel>;

export type AppWithProjectModel = App & {
    project: Project;
}