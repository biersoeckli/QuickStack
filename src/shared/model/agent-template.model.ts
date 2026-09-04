import { z } from "zod";
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
    description: z.string().trim().min(1).optional(),
    websiteUrl: z.string().url().optional(),
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
