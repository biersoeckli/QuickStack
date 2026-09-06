import { Constants } from "@/shared/utils/constants";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { BuildJobBuilderContext } from "./build-job-builder.interface";

export class BuildJobAnnotationsUtils {
    static createBuildJobAnnotations(ctx: BuildJobBuilderContext, buildMethod: AppBuildMethod, includeQueuedAt = false): Record<string, string> {
        const annotations: Record<string, string> = {
            [Constants.QS_ANNOTATION_WORKLOAD_TYPE]: ctx.workloadType,
            [Constants.QS_ANNOTATION_PROJECT_ID]: ctx.workload.projectId,
            [Constants.QS_ANNOTATION_GIT_COMMIT]: ctx.latestRemoteGitHash,
            [Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE]: ctx.latestRemoteGitCommitMessage.substring(0, 200),
            [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: ctx.deploymentId,
            [Constants.QS_ANNOTATION_BUILD_METHOD]: buildMethod,
        };
        if (ctx.workloadType === 'app') {
            annotations[Constants.QS_ANNOTATION_APP_ID] = ctx.workload.id;
        } else {
            annotations[Constants.QS_ANNOTATION_AGENT_ID] = ctx.workload.id;
        }
        if (includeQueuedAt) {
            annotations[Constants.QS_ANNOTATION_BUILD_QUEUED_AT] = ctx.queuedAt;
        }
        if (ctx.isRollback) {
            annotations[Constants.QS_ANNOTATION_ROLLBACK] = Constants.QS_ANNOTATION_VALUE_TRUE;
        }
        if (ctx.gitSshPrivateKeySecretName) {
            annotations[Constants.QS_ANNOTATION_GIT_SSH_SECRET] = ctx.gitSshPrivateKeySecretName;
        }
        return annotations;
    }
}
