import { V1Job, V1ResourceRequirements } from "@kubernetes/client-node";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";

export type BuildWorkloadModel = AppExtendedModel | AgentExtendedModel;

export type BuildJobBuilderContext = {
    workload: BuildWorkloadModel;
    workloadType: WorkloadType;
    buildName: string;
    deploymentId: string;
    latestRemoteGitHash: string;
    latestRemoteGitCommitMessage: string;
    queuedAt: string;
    nodeSelector?: Record<string, string>;
    resources?: V1ResourceRequirements;
    gitSshPrivateKeySecretName?: string;
};

export interface BuildJobBuilder {
    readonly buildMethod: AppBuildMethod;
    buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job>;
}
