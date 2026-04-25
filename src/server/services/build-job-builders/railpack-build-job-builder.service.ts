import { V1Container, V1Job } from "@kubernetes/client-node";
import { BuildJobBuilder, BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { Constants } from "@/shared/utils/constants";
import buildInitContainerService from "./build-init-container.service";
import registryService, { BUILD_NAMESPACE } from "../registry.service";

const buildkitImage = "moby/buildkit:master";
const railpackVersion = "0.15.1";
export const RAILPACK_FRONTEND_IMAGE = `ghcr.io/railwayapp/railpack-frontend:v${railpackVersion}`;

const sharedVolumeName = 'railpack-workspace';
const sharedMountPath = '/workspace';
const sourcePath = `${sharedMountPath}/source`;
const planPath = `${sharedMountPath}/plan`;
const railpackPlanFile = `${planPath}/railpack-plan.json`;
const railpackInfoFile = `${planPath}/railpack-info.json`;

class RailpackBuildJobBuilder implements BuildJobBuilder {

    readonly buildMethod: AppBuildMethod = 'RAILPACK';

    async buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job> {
        const buildkitArgs = [
            "build",
            "--local",
            `context=${sourcePath}`,
            "--local",
            `dockerfile=${planPath}`,
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
                            buildInitContainerService.getInitContainer(ctx.buildName, ctx.queuedAt),
                            this.getPreparedRailpackInitContainer(ctx),
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
                                volumeMounts: [{ name: sharedVolumeName, mountPath: sharedMountPath }],
                            },
                        ],
                        restartPolicy: "Never",
                        volumes: [
                            {
                                name: sharedVolumeName,
                                emptyDir: {},
                            },
                        ],
                    },
                },
                backoffLimit: 0,
            },
        };
    }

    private getPreparedRailpackInitContainer(ctx: BuildJobBuilderContext): V1Container {
        const gitUrl = this.getAuthenticatedGitUrl(ctx);
        const script = [
            'set -euo pipefail',
            'apt-get update',
            'apt-get install -y --no-install-recommends ca-certificates curl git',
            'rm -rf /var/lib/apt/lists/*',
            'curl -fsSL https://railpack.com/install.sh | RAILPACK_VERSION="$RAILPACK_VERSION" sh -s -- --bin-dir /usr/local/bin',
            `mkdir -p ${sourcePath} ${planPath}`,
            `git clone --depth 1 --single-branch --branch "$GIT_BRANCH" "$GIT_URL" ${sourcePath}`,
            `railpack prepare ${sourcePath} --plan-out ${railpackPlanFile} --info-out ${railpackInfoFile}`,
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
                    name: 'GIT_URL',
                    value: gitUrl,
                },
                {
                    name: 'GIT_BRANCH',
                    value: ctx.app.gitBranch ?? 'main',
                },
                {
                    name: 'RAILPACK_VERSION',
                    value: railpackVersion,
                },
            ],
            volumeMounts: [{ name: sharedVolumeName, mountPath: sharedMountPath }],
        };
    }

    private getAuthenticatedGitUrl(ctx: BuildJobBuilderContext) {
        if (ctx.app.gitUsername && ctx.app.gitToken) {
            return ctx.app.gitUrl!.replace('https://', `https://${ctx.app.gitUsername}:${ctx.app.gitToken}@`);
        }
        return ctx.app.gitUrl!;
    }
}

const railpackBuildJobBuilder = new RailpackBuildJobBuilder();
export default railpackBuildJobBuilder;
