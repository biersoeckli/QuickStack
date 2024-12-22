import { z } from "zod";

export const appSourceTypeZodModel = z.enum(["GIT", "CONTAINER"]);
export const appTypeZodModel = z.enum(["APP", "POSTGRES", "MYSQL", "MARIADB", "MONGODB"]);

export const appSourceInfoInputZodModel = z.object({
  sourceType: appSourceTypeZodModel,
  containerImageSource: z.string().nullish(),

  gitUrl: z.string().trim().nullish(),
  gitBranch: z.string().trim().nullish(),
  gitUsername: z.string().trim().nullish(),
  gitToken: z.string().trim().nullish(),
  dockerfilePath: z.string().trim().nullish(),
});
export type AppSourceInfoInputModel = z.infer<typeof appSourceInfoInputZodModel>;

export const appSourceInfoGitZodModel = z.object({
  gitUrl: z.string().trim(),
  gitBranch: z.string().trim(),
  gitUsername: z.string().trim().nullish(),
  gitToken: z.string().trim().nullish(),
  dockerfilePath: z.string().trim(),
});
export type AppSourceInfoGitModel = z.infer<typeof appSourceInfoGitZodModel>;

export const appSourceInfoContainerZodModel = z.object({
  containerImageSource: z.string().trim(),
});
export type AppSourceInfoContainerModel = z.infer<typeof appSourceInfoContainerZodModel>;
