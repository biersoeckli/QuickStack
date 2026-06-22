import { z } from "zod";

export const KUBERNETES_QUANTITY_REGEX = /^[0-9]+(\.[0-9]+)?(m|[KkMGTPE]i?)?$/;

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
    cpuRequest: z
        .string()
        .regex(KUBERNETES_QUANTITY_REGEX, 'Must be a valid Kubernetes quantity (e.g. 100m, 1, 0.5).')
        .nullish()
        .or(z.literal('')),
    cpuLimit: z
        .string()
        .regex(KUBERNETES_QUANTITY_REGEX, 'Must be a valid Kubernetes quantity (e.g. 100m, 1, 2).')
        .nullish()
        .or(z.literal('')),
    memoryRequest: z
        .string()
        .regex(KUBERNETES_QUANTITY_REGEX, 'Must be a valid Kubernetes quantity (e.g. 128Mi, 1Gi).')
        .nullish()
        .or(z.literal('')),
    memoryLimit: z
        .string()
        .regex(KUBERNETES_QUANTITY_REGEX, 'Must be a valid Kubernetes quantity (e.g. 512Mi, 2Gi).')
        .nullish()
        .or(z.literal('')),
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
