import { AppBuildMethod } from "./app-source-info.model";

export type BuildTargetSource = {
    gitCommitHash: string;
    gitCommitMessage?: string;
    isRollback?: boolean;
};

export type DeploymentSource = Partial<BuildTargetSource> & {
    buildJobName?: string;
    buildMethod?: AppBuildMethod;
};
