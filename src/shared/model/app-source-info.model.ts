import { z } from "zod";

export const appSourceTypeZodModel = z.enum(["GIT", "CONTAINER"]);
export const appTypeZodModel = z.enum(["APP", "POSTGRES", "MYSQL", "MARIADB", "MONGODB", "REDIS"]);
export const appBuildMethodZodModel = z.enum(["RAILPACK", "DOCKERFILE"]);
export type AppBuildMethod = z.infer<typeof appBuildMethodZodModel>;

const gitHttpsUrlRegex = /^https:\/\/[^\s/]+(?::\d+)?(\/[^\s]*)+$/;
const gitHubGitLabDotGitRegex = /^https:\/\/(github\.com|gitlab\.com)\//;
const gitUrlValidationMessage = 'Must be a valid HTTPS git URL. For GitHub/GitLab the .git suffix is required (e.g. https://github.com/user/repo.git)';
const gitUrlValidation = (val: string) => {
  if (!gitHttpsUrlRegex.test(val)) return false;
  if (gitHubGitLabDotGitRegex.test(val) && !val.endsWith('.git')) return false;
  return true;
};

export const appSourceInfoGitZodModel = z.object({
  gitUrl: z.string().trim().refine(gitUrlValidation, gitUrlValidationMessage),
  gitBranch: z.string().trim(),
  gitUsername: z.string().trim().nullish(),
  gitToken: z.string().trim().nullish(),
  buildMethod: appBuildMethodZodModel.default("RAILPACK"),
  dockerfilePath: z.string().trim().nullish(),
});
export type AppSourceInfoGitModel = z.infer<typeof appSourceInfoGitZodModel>;

export const appSourceInfoContainerZodModel = z.object({
  containerImageSource: z.string().trim(),
  containerRegistryUsername: z.string().trim().nullish(),
  containerRegistryPassword: z.string().trim().nullish(),
});
export type AppSourceInfoContainerModel = z.infer<typeof appSourceInfoContainerZodModel>;

export const appSourceInfoInputZodModel = z.object({
  sourceType: appSourceTypeZodModel,
  buildMethod: appBuildMethodZodModel.default("RAILPACK"),
  containerImageSource: z.string().nullish(),
  containerRegistryUsername: z.string().nullish(),
  containerRegistryPassword: z.string().nullish(),

  gitUrl: z.string().trim().refine((val) => !val || gitUrlValidation(val), gitUrlValidationMessage).nullish(),
  gitBranch: z.string().trim().nullish(),
  gitUsername: z.string().trim().nullish(),
  gitToken: z.string().trim().nullish(),
  dockerfilePath: z.string().trim().nullish(),
}).superRefine((val, ctx) => {
  if (val.sourceType === 'GIT' && val.buildMethod === 'DOCKERFILE' && !val.dockerfilePath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dockerfilePath'],
      message: 'Path to Dockerfile is required when using the Dockerfile build method.',
    });
  }
});
export type AppSourceInfoInputModel = z.infer<typeof appSourceInfoInputZodModel>;
