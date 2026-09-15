import { AppBuildMethod, appBuildMethodLabels } from "@/shared/model/app-source-info.model";

export type SourceType = 'GIT' | 'GIT_SSH' | 'CONTAINER';
export type StepId = 'source' | 'git-url' | 'ssh-url' | 'branch' | 'build-method' | 'dockerfile' | 'framework' | 'container-image' | 'summary';
export type SourceWizardInput = {
    sourceType: SourceType;
    buildMethod?: AppBuildMethod;
    containerImageSource?: string | null;
    containerRegistryUsername?: string | null;
    containerRegistryPassword?: string | null;
    gitUrl?: string | null;
    gitBranch?: string | null;
    gitUsername?: string | null;
    gitToken?: string | null;
    dockerfilePath?: string | null;
    framework?: string | null;
    installCommand?: string | null;
    buildCommand?: string | null;
    runCommand?: string | null;
    rootDirectory?: string | null;
    outputDirectory?: string | null;
    nodeVersion?: string | null;
};
export type SourceFormPatch = Partial<SourceWizardInput>;

export const sourceTypeLabels: Record<SourceType, string> = {
    GIT: 'Git HTTPS',
    GIT_SSH: 'Git SSH',
    CONTAINER: 'Docker Container Image',
};

export const buildMethodLabels: Record<AppBuildMethod, string> = appBuildMethodLabels;

export const defaultDockerfilePath = './Dockerfile';
