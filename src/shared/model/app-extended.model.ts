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

const omitFields: {
    createdAt: true;
    updatedAt: true;
} = { createdAt: true, updatedAt: true };

/** Write schema for POST upsert: id optional (absent = create), server meta fields stripped. */
export const AppExtendedWriteZodModel = AppModel
    .omit(omitFields)
    .extend({
        id: z.string().optional(),
        appDomains: AppDomainModel.merge(subItemWriteMeta).omit(omitFields).array(),
        appPorts: AppPortModel.merge(subItemWriteMeta).omit(omitFields).array(),
        appNodePorts: AppNodePortModel.merge(subItemWriteMeta).omit(omitFields).array(),
        appFileMounts: AppFileMountModel.merge(subItemWriteMeta).omit(omitFields).array(),
        appVolumes: AppVolumeModel.merge(subItemWriteMeta).omit(omitFields).array(),
        appBasicAuths: AppBasicAuthModel.merge(subItemWriteMeta).omit(omitFields).array(),
    });

export type AppExtendedWriteModel = z.infer<typeof AppExtendedWriteZodModel>;

export type AppWithProjectModel = App & {
    project: Project;
}