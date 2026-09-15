import { V1Container, V1EnvVar, V1Job } from "@kubernetes/client-node";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { BuildJobAnnotationsUtils } from "./build-job-annotations.utils";
import { BuildJobBuilderContext } from "./build-job-builder.interface";
import buildGitInitContainerService, { BUILD_GIT_SSH_KEY_VOLUME_NAME } from "./build-git-init-container.service";
import buildQueueInitContainer from "./build-init-container.service";
import { BUILD_SOURCE_PATH, BUILD_WORKSPACE_MOUNT_PATH, BUILD_WORKSPACE_VOLUME_NAME, RAILPACK_PLAN_PATH } from "./build-workspace.constants";
import registryService, { BUILD_NAMESPACE } from "../registry.service";

export type RailpackBuildOptions = {
    rootDirectory?: string | null;
    installCommand?: string | null;
    buildCommand?: string | null;
    runCommand?: string | null;
    outputDirectory?: string | null;
    nodeVersion?: string | null;
};

export class RailpackBuildJobBuilderUtils {
    /**
     * Keep the CLI and BuildKit frontend on the same Railpack release. That
     * binary embeds the matching mise-2026.8.16 builder and runtime image tags.
     */
    static readonly RAILPACK_VERSION = '0.39.0';
    static readonly RAILPACK_FRONTEND_IMAGE = `ghcr.io/railwayapp/railpack-frontend:v${RailpackBuildJobBuilderUtils.RAILPACK_VERSION}`;

    private static readonly buildkitImage = "moby/buildkit:master";
    private static readonly railpackPlanFile = `${RAILPACK_PLAN_PATH}/railpack-plan.json`;
    private static readonly railpackInfoFile = `${RAILPACK_PLAN_PATH}/railpack-info.json`;

    static resolveAppDirectory(rootDirectory?: string | null): string {
        const normalized = (rootDirectory ?? '').trim().replace(/^[.\/]+/, '').replace(/\/+$/, '');
        return !normalized || normalized === '.' ? BUILD_SOURCE_PATH : `${BUILD_SOURCE_PATH}/${normalized}`;
    }

    static getPrepareEnvArgs(options: RailpackBuildOptions = {}): string[] {
        return this.getPrepareEnvironment(options)
            .flatMap(({ name, value }) => ['--env', this.shellQuote(`${name}=${value}`)]);
    }

    static getPrepareEnvironment(options: RailpackBuildOptions = {}): V1EnvVar[] {
        const environment: V1EnvVar[] = [];
        const appendEnvironment = (name: string, value?: string | null) => {
            if (value?.trim()) {
                environment.push({ name, value: value.trim() });
            }
        };

        appendEnvironment('RAILPACK_INSTALL_CMD', options.installCommand);
        appendEnvironment('RAILPACK_BUILD_CMD', options.buildCommand);
        appendEnvironment('RAILPACK_NODE_VERSION', options.nodeVersion);
        if (options.runCommand?.trim()) appendEnvironment('RAILPACK_START_CMD', options.runCommand);
        else appendEnvironment('RAILPACK_SPA_OUTPUT_DIR', options.outputDirectory);
        return environment;
    }

    static async createBuildJob(ctx: BuildJobBuilderContext, buildMethod: AppBuildMethod, options: RailpackBuildOptions = {}): Promise<V1Job> {
        const imageNames = registryService.createBuildImageNames(ctx.workload.id, ctx.workloadType, ctx.latestRemoteGitHash, ctx.isRollback);
        const appDirectory = this.resolveAppDirectory(options.rootDirectory);
        const prepareEnvironment = this.getPrepareEnvironment(options);
        const buildkitArgs = [
            "build", "--local", `context=${appDirectory}`, "--local", `dockerfile=${RAILPACK_PLAN_PATH}`,
            "--frontend", "gateway.v0", "--opt", `source=${this.RAILPACK_FRONTEND_IMAGE}`,
            ...prepareEnvironment.flatMap(({ name }) => ['--secret', `id=${name},env=${name}`]),
            "--output", `type=image,"name=${imageNames}",push=true,registry.insecure=true`,
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
                    metadata: { annotations: BuildJobAnnotationsUtils.createBuildJobAnnotations(ctx, buildMethod) },
                    spec: {
                        hostUsers: false,
                        serviceAccountName: 'qs-build-watcher',
                        initContainers: [
                            buildQueueInitContainer.getInitContainer(ctx.buildName, ctx.queuedAt, ctx.maxParallelBuilds),
                            buildGitInitContainerService.getInitContainer(ctx),
                            this.getPreparedInitContainer(appDirectory, options),
                        ],
                        ...(ctx.nodeSelector ? { nodeSelector: ctx.nodeSelector } : {}),
                        containers: [{
                            name: ctx.buildName,
                            image: this.buildkitImage,
                            command: ["buildctl-daemonless.sh"],
                            args: buildkitArgs,
                            securityContext: { privileged: true },
                            ...(prepareEnvironment.length > 0 ? { env: prepareEnvironment } : {}),
                            ...(ctx.resources ? { resources: ctx.resources } : {}),
                            volumeMounts: [{ name: BUILD_WORKSPACE_VOLUME_NAME, mountPath: BUILD_WORKSPACE_MOUNT_PATH }],
                        }],
                        restartPolicy: "Never",
                        volumes: [
                            { name: BUILD_WORKSPACE_VOLUME_NAME, emptyDir: {} },
                            ...(ctx.gitSshPrivateKeySecretName ? [{
                                name: BUILD_GIT_SSH_KEY_VOLUME_NAME,
                                secret: { secretName: ctx.gitSshPrivateKeySecretName, defaultMode: 0o400 },
                            }] : []),
                        ],
                    },
                },
                backoffLimit: 0,
            },
        };
    }

    private static shellQuote(value: string): string {
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

    private static getPreparedInitContainer(appDirectory: string, options: RailpackBuildOptions): V1Container {
        const prepareArgs = [
            'railpack', 'prepare', appDirectory,
            '--plan-out', this.railpackPlanFile,
            '--info-out', this.railpackInfoFile,
            ...this.getPrepareEnvArgs(options),
        ];
        const script = [
            'set -euo pipefail', 'apt-get update -qq',
            'apt-get install -y -qq --no-install-recommends ca-certificates curl',
            'rm -rf /var/lib/apt/lists/*',
            `curl -fsSL https://railpack.com/install.sh | RAILPACK_VERSION="${this.RAILPACK_VERSION}" sh -s -- --bin-dir /usr/local/bin`,
            `mkdir -p ${RAILPACK_PLAN_PATH}`, prepareArgs.join(' '),
            'echo "Prepared Railpack build plan:"', `cat ${this.railpackInfoFile} || true`,
        ].join('\n');

        return {
            name: 'railpack-prepare-init',
            image: 'debian:bookworm-slim',
            command: ['bash', '-lc'],
            args: [script],
            env: [{ name: 'RAILPACK_VERSION', value: this.RAILPACK_VERSION }],
            volumeMounts: [{ name: BUILD_WORKSPACE_VOLUME_NAME, mountPath: BUILD_WORKSPACE_MOUNT_PATH }],
        };
    }
}
