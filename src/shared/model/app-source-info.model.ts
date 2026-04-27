import { z } from "zod";

export const appSourceTypeZodModel = z.enum(["GIT", "GIT_SSH", "CONTAINER"]);
export const appTypeZodModel = z.enum(["APP", "POSTGRES", "MYSQL", "MARIADB", "MONGODB", "REDIS"]);
export const appBuildMethodZodModel = z.enum(["RAILPACK", "DOCKERFILE"]);
export type AppBuildMethod = z.infer<typeof appBuildMethodZodModel>;

const gitHttpsUrlRegex = /^https:\/\/[^\s/]+(?::\d+)?(\/[^\s]*)+$/;
const gitHubGitLabDotGitRegex = /^https:\/\/(github\.com|gitlab\.com)\//;
const gitSshScpUrlRegex = /^[^\s@]+@[^\s:]+:[^\s]+$/;
const gitSshUrlRegex = /^ssh:\/\/[^\s@]+@[^\s/]+(?::\d+)?\/[^\s]+$/;
const gitUrlValidationMessage = 'Must be a valid HTTPS git URL. For GitHub/GitLab the .git suffix is required (e.g. https://github.com/user/repo.git)';
const gitBranchValidationMessage = 'Git branch is required.';
const gitUrlValidation = (val: string) => {
  if (!gitHttpsUrlRegex.test(val)) return false;
  if (gitHubGitLabDotGitRegex.test(val) && !val.endsWith('.git')) return false;
  return true;
};
const gitSshUrlValidationMessage = 'Must be a valid SSH git URL (e.g. git@github.com:user/repo.git or ssh://git@github.com/user/repo.git).';
const gitSshUrlValidation = (val: string) => gitSshScpUrlRegex.test(val) || gitSshUrlRegex.test(val);

export const appSourceInfoGitZodModel = z.object({
  gitUrl: z.string().trim().refine(gitUrlValidation, gitUrlValidationMessage),
  gitBranch: z.string().trim().min(1, gitBranchValidationMessage),
  gitUsername: z.string().trim().nullish(),
  gitToken: z.string().trim().nullish(),
  buildMethod: appBuildMethodZodModel.default("RAILPACK"),
  dockerfilePath: z.string().trim().nullish(),
});
export type AppSourceInfoGitModel = z.infer<typeof appSourceInfoGitZodModel>;

export const appSourceInfoGitSshZodModel = z.object({
  gitUrl: z.string().trim().refine(gitSshUrlValidation, gitSshUrlValidationMessage),
  gitBranch: z.string().trim().min(1, gitBranchValidationMessage),
  buildMethod: appBuildMethodZodModel.default("RAILPACK"),
  dockerfilePath: z.string().trim().nullish(),
});
export type AppSourceInfoGitSshModel = z.infer<typeof appSourceInfoGitSshZodModel>;

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

  gitUrl: z.string().trim().nullish(),
  gitBranch: z.string().trim().nullish(),
  gitUsername: z.string().trim().nullish(),
  gitToken: z.string().trim().nullish(),
  dockerfilePath: z.string().trim().nullish(),
}).superRefine((val, ctx) => {
  if (val.sourceType === 'GIT' && val.gitUrl && !gitUrlValidation(val.gitUrl)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['gitUrl'],
      message: gitUrlValidationMessage,
    });
  }
  if (val.sourceType === 'GIT_SSH' && val.gitUrl && !gitSshUrlValidation(val.gitUrl)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['gitUrl'],
      message: gitSshUrlValidationMessage,
    });
  }
  if ((val.sourceType === 'GIT' || val.sourceType === 'GIT_SSH') && !val.gitBranch) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['gitBranch'],
      message: gitBranchValidationMessage,
    });
  }
  if ((val.sourceType === 'GIT' || val.sourceType === 'GIT_SSH') && val.buildMethod === 'DOCKERFILE' && !val.dockerfilePath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dockerfilePath'],
      message: 'Path to Dockerfile is required when using the Dockerfile build method.',
    });
  }
});
export type AppSourceInfoInputModel = z.infer<typeof appSourceInfoInputZodModel>;
