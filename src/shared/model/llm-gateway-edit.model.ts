import { z } from "zod";

export const llmGatewayEditZodModel = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Name is required.'),
  baseUrl: z.string().trim().min(1, 'Base URL is required.'),
  adminKey: z.string().optional().default(''),
}).superRefine((value, ctx) => {
  if (!value.id && !value.adminKey?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['adminKey'],
      message: 'LiteLLM Admin Key is required.',
    });
  }
});

export type LlmGatewayEditModel = z.infer<typeof llmGatewayEditZodModel>;
