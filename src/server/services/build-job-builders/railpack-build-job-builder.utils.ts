import { V1Container, V1Job } from "@kubernetes/client-node";
import { BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import buildQueueInitContainer from "./build-init-container.service";
import buildGitInitContainerService, { BUILD_GIT_SSH_KEY_VOLUME_NAME } from "./build-git-init-container.service";
import registryService, { BUILD_NAMESPACE } from "../registry.service";
import { BUILD_SOURCE_PATH, BUILD_WORKSPACE_MOUNT_PATH, BUILD_WORKSPACE_VOLUME_NAME, RAILPACK_PLAN_PATH } from "./build-workspace.constants";
import { BuildJobAnnotationsUtils } from "./build-job-annotations.utils";

const buildkitImage = "moby/buildkit:master";
export const RAILPACK_VERSION = "0.15.1";
export const RAILPACK_FRONTEND_IMAGE = `ghcr.io/railwayapp/railpack-frontend:v${RAILPACK_VERSION}`;

const railpackPlanFile = `${RAILPACK_PLAN_PATH}/railpack-plan.json`;
const railpackInfoFile = `${RAILPACK_PLAN_PATH}/railpack-info.json`;

export type RailpackBuildOptions = {
    rootDirectory?: string | null;
    installCommand?: string | null;
    buildCommand?: string | null;
    runCommand?: string | null;
    outputDirectory?: string | null;
    nodeVersion?: string | null;
};

export function resolveRailpackAppDirectory(rootDirectory?: string | null): string {
    const normalized = (rootDirectory ?? '').trim().replace(/^[.\/]+/, '').replace(/\/+$/, '');
    if (!normalized || normalized === '.') {
        return BUILD_SOURCE_PATH;
    }
    return `${BUILD_SOURCE_PATH}/${normalized}`;
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function getRailpackPrepareEnvArgs(options: RailpackBuildOptions = {}): string[] {
    const args: string[] = [];
    const appendEnv = (key: string, value?: string | null) => {
        if (!value?.trim()) {
            return;
        }
        args.push('--env', shellQuote(`${key}=${value.trim()}`));
    };

    appendEnv('RAILPACK_INSTALL_CMD', options.installCommand);
    appendEnv('RAILPACK_BUILD_CMD', options.buildCommand);
    appendEnv('RAILPACK_NODE_VERSION', options.nodeVersion);
    if (options.runCommand?.trim()) {
        appendEnv('RAILPACK_START_CMD', options.runCommand);
    } else {
        appendEnv('RAILPACK_SPA_OUTPUT_DIR', options.outputDirectory);
    }

    return args;
}

export async function createRailpackBuildJob(
    ctx: BuildJobBuilderContext,
    buildMethod: AppBuildMethod,
    options: RailpackBuildOptions = {},
): Promise<V1Job> {
    const imageNames = registryService.createBuildImageNames(ctx.workload.id, ctx.workloadType, ctx.latestRemoteGitHash, ctx.isRollback);
    const appDirectory = resolveRailpackAppDirectory(options.rootDirectory);

    const buildkitArgs = [
        "build",
        "--local",
        `context=${appDirectory}`,
        "--local",
        `dockerfile=${RAILPACK_PLAN_PATH}`,
        "--frontend",
        "gateway.v0",
        "--opt",
        `source=${RAILPACK_FRONTEND_IMAGE}`,
        "--output",
        `type=image,"name=${imageNames}",push=true,registry.insecure=true`
    ];

    return {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: {
            name: ctx.buildName,
            namespace: BUILD_NAMESPACE,
            annotations: BuildJobAnnotationsUtils.createBuildJobAnnotations(ctx, buildMethod, true),
        },
        spec: {
            ttlSecondsAfterFinished: 86400,
            template: {
                metadata: {
                    annotations: BuildJobAnnotationsUtils.createBuildJobAnnotations(ctx, buildMethod),
                },
                spec: {
                    hostUsers: false,
                    serviceAccountName: 'qs-build-watcher',
                    initContainers: [
                        buildQueueInitContainer.getInitContainer(ctx.buildName, ctx.queuedAt, ctx.maxParallelBuilds),
                        buildGitInitContainerService.getInitContainer(ctx),
                        getPreparedRailpackInitContainer(appDirectory, options),
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

function getPreparedRailpackInitContainer(appDirectory: string, options: RailpackBuildOptions): V1Container {
    const prepareArgs = [
        'railpack',
        'prepare',
        appDirectory,
        '--plan-out',
        railpackPlanFile,
        '--info-out',
        railpackInfoFile,
        ...getRailpackPrepareEnvArgs(options),
    ];

    const script = [
        'set -euo pipefail',
        'apt-get update -qq',
        'apt-get install -y -qq --no-install-recommends ca-certificates curl',
        'rm -rf /var/lib/apt/lists/*',
        'curl -fsSL https://railpack.com/install.sh | RAILPACK_VERSION="$RAILPACK_VERSION" sh -s -- --bin-dir /usr/local/bin',
        `mkdir -p ${RAILPACK_PLAN_PATH}`,
        prepareArgs.join(' '),
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
                value: RAILPACK_VERSION,
            },
        ],
        volumeMounts: [{ name: BUILD_WORKSPACE_VOLUME_NAME, mountPath: BUILD_WORKSPACE_MOUNT_PATH }],
    };
}
