import { V1Job } from "@kubernetes/client-node";
import { BuildJobBuilder, BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { Constants } from "@/shared/utils/constants";
import buildQueueInitContainer from "./build-init-container.service";
import buildGitInitContainerService from "./build-git-init-container.service";
import registryService, { BUILD_NAMESPACE } from "../registry.service";
import { PathUtils } from "@/server/utils/path.utils";
import { BUILD_SOURCE_PATH, BUILD_WORKSPACE_MOUNT_PATH, BUILD_WORKSPACE_VOLUME_NAME } from "./build-workspace.constants";

const buildkitImage = "moby/buildkit:master";

class DockerfileBuildJobBuilder implements BuildJobBuilder {
    readonly buildMethod: AppBuildMethod = 'DOCKERFILE';

    async buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job> {
        const contextPaths = PathUtils.splitPath(ctx.app.dockerfilePath || './Dockerfile');
        const dockerfileContextPath = this.getDockerfileContextPath(contextPaths.folderPath);

        const buildkitArgs = [
            "build",
            "--frontend",
            "dockerfile.v0",
            "--local",
            `context=${dockerfileContextPath}`,
            "--local",
            `dockerfile=${dockerfileContextPath}`,
            "--opt",
            `filename=${contextPaths.filePath}`,
            "--output",
            `type=image,name=${registryService.createInternalContainerRegistryUrlForAppId(ctx.app.id)},push=true,registry.insecure=true`
        ];

        return {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
                name: ctx.buildName,
                namespace: BUILD_NAMESPACE,
                annotations: {
                    [Constants.QS_ANNOTATION_APP_ID]: ctx.app.id,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: ctx.app.projectId,
                    [Constants.QS_ANNOTATION_GIT_COMMIT]: ctx.latestRemoteGitHash,
                    [Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE]: ctx.latestRemoteGitCommitMessage.substring(0, 200),
                    [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: ctx.deploymentId,
                    [Constants.QS_ANNOTATION_BUILD_QUEUED_AT]: ctx.queuedAt,
                    [Constants.QS_ANNOTATION_BUILD_METHOD]: this.buildMethod,
                }
            },
            spec: {
                ttlSecondsAfterFinished: 86400,
                template: {
                    metadata: {
                        annotations: {
                            [Constants.QS_ANNOTATION_APP_ID]: ctx.app.id,
                            [Constants.QS_ANNOTATION_PROJECT_ID]: ctx.app.projectId,
                            [Constants.QS_ANNOTATION_GIT_COMMIT]: ctx.latestRemoteGitHash,
                            [Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE]: ctx.latestRemoteGitCommitMessage.substring(0, 200),
                            [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: ctx.deploymentId,
                            [Constants.QS_ANNOTATION_BUILD_METHOD]: this.buildMethod,
                        },
                    },
                    spec: {
                        hostUsers: false,
                        serviceAccountName: 'qs-build-watcher',
                        initContainers: [
                            buildQueueInitContainer.getInitContainer(ctx.buildName, ctx.queuedAt),
                            buildGitInitContainerService.getInitContainer(ctx),
                        ],
                        ...(ctx.nodeSelector ? { nodeSelector: ctx.nodeSelector } : {}),
                        containers: [
                            {
                                name: ctx.buildName,
                                image: buildkitImage,
                                command: ["buildctl-daemonless.sh"],
                                args: buildkitArgs,
                                securityContext: {
                                    privileged: true
                                },
                                ...(ctx.resources ? { resources: ctx.resources } : {}),
                                volumeMounts: [{ name: BUILD_WORKSPACE_VOLUME_NAME, mountPath: BUILD_WORKSPACE_MOUNT_PATH }],
                            },
                        ],
                        restartPolicy: "Never",
                        volumes: [
                            {
                                name: BUILD_WORKSPACE_VOLUME_NAME,
                                emptyDir: {},
                            },
                        ],
                    },
                },
                backoffLimit: 0,
            },
        };
    }

    private getDockerfileContextPath(folderPath: string | undefined) {
        if (!folderPath) {
            return BUILD_SOURCE_PATH;
        }

        return `${BUILD_SOURCE_PATH}/${folderPath.replace(/^\.\//, '')}`;
    }
}

const dockerfileBuildJobBuilder = new DockerfileBuildJobBuilder();
export default dockerfileBuildJobBuilder;
