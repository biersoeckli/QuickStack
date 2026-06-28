import { z } from "zod";
import { stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { containerCommandArgsZodModel } from "@/shared/model/app-container-config.model";
import {
    appDockerfileDetectionZodModel,
    appGitBranchesLookupZodModel,
    appSourceInfoContainerZodModel,
    appSourceInfoGitSshZodModel,
    appSourceInfoGitZodModel,
} from "@/shared/model/app-source-info.model";

export const agentEnvVarModel = z.object({
    name: z
        .string()
        .min(1, 'Environment variable name is required.')
        .max(63, 'Environment variable name must be 63 characters or fewer.')
        .regex(/^[A-Z_][A-Z0-9_]*$/, 'Must be a valid Kubernetes environment variable name (uppercase letters, digits, underscores, starting with a letter or underscore).'),
    value: z.string().min(1, 'Environment variable value is required.'),
});

export type AgentEnvVarModel = z.infer<typeof agentEnvVarModel>;

export const QUICKSTACK_RESERVED_ENV_PREFIX = 'QS_';

export function isQuickStackReservedEnvName(name: string): boolean {
    return name.toUpperCase().startsWith(QUICKSTACK_RESERVED_ENV_PREFIX);
}

export const agentEnvVarFormModel = z.object({
    envVars: z.array(agentEnvVarModel).default([]),
});

export const agentConfigZodModel = z.object({
    sourceType: z.enum(["GIT", "GIT_SSH", "CONTAINER"]).default("CONTAINER"),
    buildMethod: z.literal("DOCKERFILE").default("DOCKERFILE"),
    containerImageSource: z.string().trim().nullish(),
    containerRegistryUsername: z.string().trim().nullish(),
    containerRegistryPassword: z.string().trim().nullish(),
    gitUrl: z.string().trim().nullish(),
    gitBranch: z.string().trim().nullish(),
    gitUsername: z.string().trim().nullish(),
    gitToken: z.string().trim().nullish(),
    dockerfilePath: z.string().trim().nullish(),
    cpuRequest: stringToOptionalNumber,
    cpuLimit: stringToOptionalNumber,
    memoryRequest: stringToOptionalNumber,
    memoryLimit: stringToOptionalNumber,
    containerCommand: containerCommandArgsZodModel.shape.containerCommand,
    containerArgs: containerCommandArgsZodModel.shape.containerArgs,
    warmPoolReplicas: z.preprocess((val) => {
        if (val === null || val === undefined || val === '') {
            return 0;
        }
        if (typeof val === 'string') {
            return Number(val);
        }
        return val;
    }, z.number().int().min(0, 'Warm Pool Replicas must be between 0 and 10').max(10, 'Warm Pool Replicas must be between 0 and 10').default(0)),
    systemPrompt: z.string().nullish(),
    envVars: z
        .array(
            z.object({
                name: z
                    .string()
                    .min(1, 'Environment variable name is required.')
                    .max(63)
                    .regex(/^[A-Z_][A-Z0-9_]*$/, 'Must be a valid Kubernetes environment variable name.'),
                value: z.string().min(1, 'Value is required.'),
            })
        )
        .default([])
        .superRefine((envVars, ctx) => {
            const names = envVars.map((e) => e.name.toUpperCase());
            const seen = new Set<string>();
            names.forEach((name, idx) => {
                if (isQuickStackReservedEnvName(name)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `"${name}" is a reserved QuickStack environment variable name. Names starting with "${QUICKSTACK_RESERVED_ENV_PREFIX}" are not allowed.`,
                        path: [idx, 'name'],
                    });
                }
                if (seen.has(name)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Duplicate environment variable name: "${name}".`,
                        path: [idx, 'name'],
                    });
                }
                seen.add(name);
            });
        }),
    modelAlias: z.string().nullish(),
    llmGatewayId: z.string().nullish(),
});

export type AgentConfigModel = z.infer<typeof agentConfigZodModel>;
export type AgentConfigInputModel = z.input<typeof agentConfigZodModel>;

// ── Per-card schemas ──────────────────────────────────────────────

export const agentModelConfigurationZodModel = agentConfigZodModel.pick({
    llmGatewayId: true,
    modelAlias: true,
});
export type AgentModelConfigurationModel = z.infer<typeof agentModelConfigurationZodModel>;

export const agentSourceInfoGitZodModel = appSourceInfoGitZodModel.extend({
    buildMethod: z.literal("DOCKERFILE").default("DOCKERFILE"),
    dockerfilePath: z.string().trim().min(1, 'Path to Dockerfile is required.'),
});
export type AgentSourceInfoGitModel = z.infer<typeof agentSourceInfoGitZodModel>;

export const agentSourceInfoGitSshZodModel = appSourceInfoGitSshZodModel.extend({
    buildMethod: z.literal("DOCKERFILE").default("DOCKERFILE"),
    dockerfilePath: z.string().trim().min(1, 'Path to Dockerfile is required.'),
});
export type AgentSourceInfoGitSshModel = z.infer<typeof agentSourceInfoGitSshZodModel>;

export const agentSourceInfoContainerZodModel = appSourceInfoContainerZodModel;
export type AgentSourceInfoContainerModel = z.infer<typeof agentSourceInfoContainerZodModel>;

export const agentGitBranchesLookupZodModel = appGitBranchesLookupZodModel;
export type AgentGitBranchesLookupModel = z.infer<typeof agentGitBranchesLookupZodModel>;

export const agentDockerfileDetectionZodModel = appDockerfileDetectionZodModel;
export type AgentDockerfileDetectionModel = z.infer<typeof agentDockerfileDetectionZodModel>;

export const agentSourceInfoInputZodModel = z.object({
    sourceType: z.enum(["GIT", "GIT_SSH", "CONTAINER"]),
    buildMethod: z.literal("DOCKERFILE").default("DOCKERFILE"),
    containerImageSource: z.string().nullish(),
    containerRegistryUsername: z.string().nullish(),
    containerRegistryPassword: z.string().nullish(),
    gitUrl: z.string().trim().nullish(),
    gitBranch: z.string().trim().nullish(),
    gitUsername: z.string().trim().nullish(),
    gitToken: z.string().trim().nullish(),
    dockerfilePath: z.string().trim().nullish(),
});
export type AgentSourceInfoInputModel = z.infer<typeof agentSourceInfoInputZodModel>;

export const agentSourceZodModel = agentSourceInfoInputZodModel;
export type AgentSourceModel = AgentSourceInfoInputModel;

export const agentRateLimitsZodModel = agentConfigZodModel.pick({
    cpuRequest: true,
    cpuLimit: true,
    memoryRequest: true,
    memoryLimit: true,
});
export type AgentRateLimitsModel = z.infer<typeof agentRateLimitsZodModel>;

export const agentContainerConfigZodModel = agentConfigZodModel.pick({
    containerCommand: true,
    containerArgs: true,
    warmPoolReplicas: true,
});
export type AgentContainerConfigModel = z.infer<typeof agentContainerConfigZodModel>;

export const agentSystemPromptZodModel = agentConfigZodModel.pick({
    systemPrompt: true,
});
export type AgentSystemPromptModel = z.infer<typeof agentSystemPromptZodModel>;

export const agentEnvVarsZodModel = agentConfigZodModel.pick({
    envVars: true,
});
export type AgentEnvVarsModel = z.infer<typeof agentEnvVarsZodModel>;
