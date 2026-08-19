import { z } from "zod";
import { AppBasicAuthModel, AppDomainModel, AppFileMountModel, AppModel, AppNetworkPolicyModel, AppNetworkPolicyRuleModel, AppNodePortModel, AppPortModel, AppVolumeModel, ProjectModel } from "./generated-zod";
import { App, Project } from "@prisma/client";

export const AppNetworkPolicyRuleWithTargetZodModel = AppNetworkPolicyRuleModel.extend({
    targetApp: z.object({ id: z.string(), name: z.string(), projectId: z.string() }).nullish(),
    targetAgent: z.object({ id: z.string(), name: z.string(), projectId: z.string() }).nullish(),
});
export type AppNetworkPolicyRuleWithTargetModel = z.infer<typeof AppNetworkPolicyRuleWithTargetZodModel>;
export type AppNetworkPolicyRuleWithTargetAppModel = AppNetworkPolicyRuleWithTargetModel;

const AppNetworkPolicyWithRulesZodModel = AppNetworkPolicyModel.extend({
    rules: z.array(AppNetworkPolicyRuleWithTargetZodModel),
});

export const AppExtendedZodModel = z.lazy(() => AppModel.extend({
    networkPolicyMode: z.string().optional(),
    project: ProjectModel,
    appDomains: AppDomainModel.array(),
    appPorts: AppPortModel.array(),
    appNodePorts: AppNodePortModel.array(),
    appFileMounts: AppFileMountModel.array(),
    appVolumes: AppVolumeModel.array(),
    appBasicAuths: AppBasicAuthModel.array(),
    appNetworkPolicy: AppNetworkPolicyWithRulesZodModel.nullish(),
}))

export type AppExtendedModel = z.infer<typeof AppExtendedZodModel>;

const subItemWriteMeta = z.object({
    id: z.string().optional(),
    appId: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

const omitFields = { createdAt: true, updatedAt: true } as const;

const omitFieldsSubObjects = { ...omitFields, appId: true } as const;

const appNetworkPolicyRuleWriteZodModel = AppNetworkPolicyRuleModel.omit({
    id: true, appNetworkPolicyId: true, createdAt: true, updatedAt: true,
}).extend({ id: z.string().optional() }).refine(
    (rule) => Boolean(rule.targetAppId) !== Boolean(rule.targetAgentId),
    'A network policy rule must reference exactly one app or agent.',
);

const appNetworkPolicyWriteZodModel = AppNetworkPolicyModel.omit({
    id: true, appId: true, createdAt: true, updatedAt: true,
}).extend({ id: z.string().optional(), rules: appNetworkPolicyRuleWriteZodModel.array() });

/** Write schema for POST upsert: id optional (absent = create), server meta fields stripped. */
export const AppExtendedWriteZodModel = AppModel
    .omit({ ...omitFields, networkPolicyMode: true })
    .extend({
        id: z.string().optional(),
        networkPolicyMode: z.string().optional(),
        appDomains: AppDomainModel.merge(subItemWriteMeta).omit(omitFieldsSubObjects).array(),
        appPorts: AppPortModel.merge(subItemWriteMeta).omit(omitFieldsSubObjects).array(),
        appNodePorts: AppNodePortModel.merge(subItemWriteMeta).omit(omitFieldsSubObjects).array(),
        appFileMounts: AppFileMountModel.merge(subItemWriteMeta).omit(omitFieldsSubObjects).array(),
        appVolumes: AppVolumeModel.merge(subItemWriteMeta).omit(omitFieldsSubObjects).array(),
        appBasicAuths: AppBasicAuthModel.merge(subItemWriteMeta).omit(omitFieldsSubObjects).array(),
        appNetworkPolicy: appNetworkPolicyWriteZodModel.nullable(),
    });

export type AppExtendedWriteModel = z.infer<typeof AppExtendedWriteZodModel>;

export type AppWithProjectModel = App & {
    project: Project;
}
