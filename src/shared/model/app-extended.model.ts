import { z } from "zod";
import { AppBasicAuthModel, AppDomainModel, AppFileMountModel, AppModel, AppNodePortModel, AppPortModel, AppVolumeModel, ProjectModel, VolumeBackupModel } from "./generated-zod";
import { App, Project } from "@prisma/client";

export const AppExtendedZodModel= z.lazy(() => AppModel.extend({
    project: ProjectModel,
    appDomains: AppDomainModel.array(),
    appPorts: AppPortModel.array(),
    appNodePorts: AppNodePortModel.array(),
    appFileMounts: AppFileMountModel.array(),
    appVolumes: AppVolumeModel.array(),
    appBasicAuths: AppBasicAuthModel.array(),
  }))

export type AppExtendedModel = z.infer<typeof AppExtendedZodModel>;

const subItemWriteMeta = z.object({
    id: z.string().optional(),
    appId: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

/** Write schema for POST upsert: id optional (absent = create), server meta fields stripped. */
export const AppExtendedWriteZodModel = AppModel
    .omit({ createdAt: true, updatedAt: true })
    .extend({
        id: z.string().optional(),
        appDomains: AppDomainModel.merge(subItemWriteMeta).array(),
        appPorts: AppPortModel.merge(subItemWriteMeta).array(),
        appNodePorts: AppNodePortModel.merge(subItemWriteMeta).array(),
        appFileMounts: AppFileMountModel.merge(subItemWriteMeta).array(),
        appVolumes: AppVolumeModel.merge(subItemWriteMeta).array(),
        appBasicAuths: AppBasicAuthModel.merge(subItemWriteMeta).array(),
    });

export type AppExtendedWriteModel = z.infer<typeof AppExtendedWriteZodModel>;

export type AppWithProjectModel = App & {
    project: Project;
}