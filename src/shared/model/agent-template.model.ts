import { z } from "zod";
import { AgentDomainModel, AgentFileMountModel, AgentModel, AgentVolumeModel } from "./generated-zod";
import { agentStorageClassNameZodModel } from "./volume-edit.model";
import { appTemplateInputSettingsZodModel } from "./app-template.model";
import { AgentExtendedWriteZodModel } from "./agent-extended.model";

export const agentTemplateContentZodModel = z.object({
    inputSettings: appTemplateInputSettingsZodModel.array(),
})
    .extend(AgentExtendedWriteZodModel.shape)
    .omit({
        id: true,
        projectId: true
    });

export type AgentTemplateContentModel = z.infer<typeof agentTemplateContentZodModel>;

export const agentTemplateZodModel = z.object({
    name: z.string(),
    iconName: z.string().nullish(),
    templates: agentTemplateContentZodModel.array(),
});

export type AgentTemplateModel = z.infer<typeof agentTemplateZodModel>;

export type AgentTemplatePostCreateContext = {
    templateName: string;
    templates: {
        agentName: string;
        inputSettings: z.infer<typeof appTemplateInputSettingsZodModel>[];
    }[];
};
