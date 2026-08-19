import { z } from "zod";

export const ssoProviderTypes = [
  "OIDC",
  "GOOGLE",
  "AZURE_AD",
  "GITHUB",
] as const;

export const ssoProviderEditZodModel = z
  .object({
    id: z.string().uuid().optional(),
    type: z.enum(ssoProviderTypes),
    name: z.string().trim().min(1, "Display name is required."),
    enabled: z.boolean().default(false),
    clientId: z.string().trim().min(1, "Client ID is required."),
    clientSecret: z.string().optional().default(""),
    issuer: z.string().trim().optional().default(""),
    tenantId: z.string().trim().optional().default(""),
    defaultUserGroupId: z.string().uuid("Default user group is required."),
  });

export type SsoProviderEditModel = z.infer<typeof ssoProviderEditZodModel>;
export type SsoProviderUiModel = Omit<SsoProviderEditModel, "clientSecret"> & {
  id: string;
  hasClientSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
};
