import { z } from "zod";
import { stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { containerCommandArgsZodModel } from "@/shared/model/app-container-config.model";

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
    image: z.string().trim().nullish(),
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

export const agentSourceZodModel = agentConfigZodModel.pick({
    image: true,
    llmGatewayId: true,
    modelAlias: true,
});
export type AgentSourceModel = z.infer<typeof agentSourceZodModel>;

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
