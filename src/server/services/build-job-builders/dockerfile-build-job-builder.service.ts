import { V1Job } from "@kubernetes/client-node";
import { BuildJobBuilder, BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import buildQueueInitContainer from "./build-init-container.service";
import buildGitInitContainerService, { BUILD_GIT_SSH_KEY_VOLUME_NAME } from "./build-git-init-container.service";
import registryService, { BUILD_NAMESPACE } from "../registry.service";
import { PathUtils } from "@/server/utils/path.utils";
import { BUILD_SOURCE_PATH, BUILD_WORKSPACE_MOUNT_PATH, BUILD_WORKSPACE_VOLUME_NAME } from "./build-workspace.constants";
import { BuildJobAnnotationsUtils } from "./build-job-annotations.utils";

const buildkitImage = "moby/buildkit:master";

class DockerfileBuildJobBuilder implements BuildJobBuilder {
    readonly buildMethod: AppBuildMethod = 'DOCKERFILE';

    async buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job> {
        const contextPaths = PathUtils.splitPath(ctx.workload.dockerfilePath || './Dockerfile');
        const dockerfileContextPath = this.getDockerfileContextPath(contextPaths.folderPath);
        const imageNames = registryService.createBuildImageNames(ctx.workload.id, ctx.workloadType, ctx.latestRemoteGitHash, ctx.isRollback);

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
            `type=image,"name=${imageNames}",push=true,registry.insecure=true`
        ];

        return {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
                name: ctx.buildName,
                namespace: BUILD_NAMESPACE,
                annotations: BuildJobAnnotationsUtils.createBuildJobAnnotations(ctx, this.buildMethod, true),
            },
            spec: {
                ttlSecondsAfterFinished: 86400,
                template: {
                    metadata: {
                        annotations: BuildJobAnnotationsUtils.createBuildJobAnnotations(ctx, this.buildMethod),
                    },
                    spec: {
                        hostUsers: false,
                        serviceAccountName: 'qs-build-watcher',
                        initContainers: [
                            buildQueueInitContainer.getInitContainer(ctx.buildName, ctx.queuedAt, ctx.maxParallelBuilds),
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
                            ...(ctx.gitSshPrivateKeySecretName ? [{
                                name: BUILD_GIT_SSH_KEY_VOLUME_NAME,
                                secret: {
                                    secretName: ctx.gitSshPrivateKeySecretName,
                                    defaultMode: 0o400,
                                },
                            }] : []),
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
