import { z } from "zod";
import { AppDomainModel, AppFileMountModel, AppModel, AppPortModel, AppVolumeModel, RelatedAppDomainModel, RelatedAppPortModel, RelatedAppVolumeModel } from "./generated-zod";
import { appSourceTypeZodModel, appTypeZodModel } from "./app-source-info.model";
import { appVolumeTypeZodModel, storageClassNameZodModel } from "./volume-edit.model";

const appModelWithRelations = z.lazy(() => AppModel.extend({
    projectId: z.undefined().optional(),
    buildMethod: z.undefined().optional(),
    dockerfilePath: z.undefined().optional(),
    appType: appTypeZodModel,
    sourceType: appSourceTypeZodModel,
    id: z.undefined().optional(),
    createdAt: z.undefined().optional(),
    updatedAt: z.undefined().optional(),
}));

export const appTemplateInputSettingsZodModel = z.object({
    key: z.string(),
    label: z.string(),
    value: z.any(),
    isEnvVar: z.boolean(),
    randomGeneratedIfEmpty: z.boolean(),
});
export type AppTemplateInputSettingsModel = z.infer<typeof appTemplateInputSettingsZodModel>;

export const appTemplateContentZodModel = z.object({
    inputSettings: appTemplateInputSettingsZodModel.array(),
    appModel: appModelWithRelations,
    appDomains: AppDomainModel.array(),
    appVolumes: AppVolumeModel.extend({
        accessMode: appVolumeTypeZodModel,
        storageClassName: storageClassNameZodModel.default('longhorn'),
        id: z.undefined().optional(),
        appId: z.undefined().optional(),
        createdAt: z.undefined().optional(),
        updatedAt: z.undefined().optional(),
    }).array(),
    appFileMounts: AppFileMountModel.extend({
        id: z.undefined().optional(),
        appId: z.undefined().optional(),
        createdAt: z.undefined().optional(),
        updatedAt: z.undefined().optional(),
    }).array(),
    appPorts: AppPortModel.extend({
        id: z.undefined().optional(),
        appId: z.undefined().optional(),
        createdAt: z.undefined().optional(),
        updatedAt: z.undefined().optional(),
    }).array(),
});
export type AppTemplateContentModel = z.infer<typeof appTemplateContentZodModel>;

export const appTemplateZodModel = z.object({
    name: z.string(),
    iconName: z.string().nullish(),
    templates: appTemplateContentZodModel.array(),
});

export type AppTemplateModel = z.infer<typeof appTemplateZodModel>;
