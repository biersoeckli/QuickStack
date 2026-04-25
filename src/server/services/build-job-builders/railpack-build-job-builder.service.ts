import { V1Container, V1Job } from "@kubernetes/client-node";
import { BuildJobBuilder, BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { Constants } from "@/shared/utils/constants";
import buildQueueInitContainer from "./build-init-container.service";
import buildGitInitContainerService from "./build-git-init-container.service";
import registryService, { BUILD_NAMESPACE } from "../registry.service";
import { BUILD_SOURCE_PATH, BUILD_WORKSPACE_MOUNT_PATH, BUILD_WORKSPACE_VOLUME_NAME, RAILPACK_PLAN_PATH } from "./build-workspace.constants";

const buildkitImage = "moby/buildkit:master";
const railpackVersion = "0.15.1";
export const RAILPACK_FRONTEND_IMAGE = `ghcr.io/railwayapp/railpack-frontend:v${railpackVersion}`;

const railpackPlanFile = `${RAILPACK_PLAN_PATH}/railpack-plan.json`;
const railpackInfoFile = `${RAILPACK_PLAN_PATH}/railpack-info.json`;

class RailpackBuildJobBuilder implements BuildJobBuilder {

    readonly buildMethod: AppBuildMethod = 'RAILPACK';

    async buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job> {
        const buildkitArgs = [
            "build",
            "--local",
            `context=${BUILD_SOURCE_PATH}`,
            "--local",
            `dockerfile=${RAILPACK_PLAN_PATH}`,
            "--frontend",
            "gateway.v0",
            "--opt",
            `source=${RAILPACK_FRONTEND_IMAGE}`,
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
                            this.getPreparedRailpackInitContainer(),
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

    private getPreparedRailpackInitContainer(): V1Container {
        const script = [
            'set -euo pipefail',
            'apt-get update -qq',
            'apt-get install -y -qq --no-install-recommends ca-certificates curl',
            'rm -rf /var/lib/apt/lists/*',
            'curl -fsSL https://railpack.com/install.sh | RAILPACK_VERSION="$RAILPACK_VERSION" sh -s -- --bin-dir /usr/local/bin',
            `mkdir -p ${RAILPACK_PLAN_PATH}`,
            `railpack prepare ${BUILD_SOURCE_PATH} --plan-out ${railpackPlanFile} --info-out ${railpackInfoFile}`,
            'echo "Prepared Railpack build plan:"',
            `cat ${railpackInfoFile} || true`,
        ].join('\n');

        return {
            name: 'railpack-prepare-init',
            image: 'debian:bookworm-slim',
            command: ['bash', '-lc'],
            args: [script],
            env: [
                {
                    name: 'RAILPACK_VERSION',
                    value: railpackVersion,
                },
            ],
            volumeMounts: [{ name: BUILD_WORKSPACE_VOLUME_NAME, mountPath: BUILD_WORKSPACE_MOUNT_PATH }],
        };
    }
}

const railpackBuildJobBuilder = new RailpackBuildJobBuilder();
export default railpackBuildJobBuilder;
