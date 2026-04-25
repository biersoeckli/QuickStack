import { V1Job, V1ResourceRequirements } from "@kubernetes/client-node";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";

export type BuildJobBuilderContext = {
    app: AppExtendedModel;
    buildName: string;
    deploymentId: string;
    latestRemoteGitHash: string;
    latestRemoteGitCommitMessage: string;
    queuedAt: string;
    nodeSelector?: Record<string, string>;
    resources?: V1ResourceRequirements;
};

export interface BuildJobBuilder {
    readonly buildMethod: AppBuildMethod;
    buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job>;
}
