import { V1Volume, V1VolumeMount } from "@kubernetes/client-node";
import {
    SANDBOX_API_GROUP,
    SANDBOX_API_VERSION,
} from "../adapter/agent-sandbox.adapter";
import { SandboxClaim, SandboxTemplate, SandboxWarmPool } from "../adapter/api-clients/types/agents.models";
import { Constants } from "@/shared/utils/constants";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import {
    ContainerCommangArgsUtils,
} from "@/shared/utils/container-command-args.utils";
import networkPolicyService from "./network-policy.service";
import type { AgentSandboxTemplateNetworkPolicyConfig } from "./network-policy.service";
import type { LiteLlmModelMetadata } from "../adapter/litellm-api.adapter";
import { AgentDomain } from "@prisma/client";
import { ServiceException } from "@/shared/model/service.exception.model";

const FILEBROWSER_PORT = 80;
const FILEBROWSER_BASE_URL = '/files';
type SandboxContainer = SandboxTemplate['spec']['podTemplate']['spec']['containers'][number];
type SandboxProbe = NonNullable<SandboxContainer['readinessProbe']>;

export type AgentSandboxTemplateConfig = {
    id: string;
    projectId: string;
    containerImageSource: string;
    modelAlias: string[];
    modelMetadata?: Record<string, LiteLlmModelMetadata>;
    llmGateway?: { baseUrl: string } | null;
    cpuRequest?: number | null;
    cpuLimit?: number | null;
    memoryRequest?: number | null;
    memoryLimit?: number | null;
    containerCommand?: string | null;
    containerArgs?: string | null;
    workingDir?: string | null;
    deployFileBrowser: boolean;
    healthChechHttpGetPath?: string | null;
    healthCheckHttpScheme?: string | null;
    healthCheckHttpHeadersJson?: string | null;
    healthCheckHttpPort?: number | null;
    healthCheckPeriodSeconds: number;
    healthCheckTimeoutSeconds: number;
    healthCheckFailureThreshold: number;
    healthCheckTcpPort?: number | null;
    volumePvcData: {
        volume: V1Volume;
        volumeMount: V1VolumeMount;
    }[];
    fileVolumes: V1Volume[];
    fileVolumeMounts: V1VolumeMount[];
    agentDomains: AgentDomain[];
    agentNetworkPolicy?: AgentSandboxTemplateNetworkPolicyConfig;
};

export type SandboxTemplateDeploymentInfo = {
    dockerPullSecretName?: string;
    deploymentId?: string;
    buildJobName?: string;
    gitCommitHash?: string;
    gitCommitMessage?: string;
};

class AgentSandboxTemplateBuilder {

    private buildHealthCheckProbe(agent: AgentSandboxTemplateConfig): SandboxProbe | undefined {
        if (!agent.healthChechHttpGetPath && !agent.healthCheckTcpPort) {
            return undefined;
        }
        if (agent.healthChechHttpGetPath && agent.healthCheckTcpPort) {
            throw new ServiceException('Both HTTP and TCP health checks are configured. Please configure only one type of health check.');
        }

        const probeSettings = {
            periodSeconds: agent.healthCheckPeriodSeconds,
            timeoutSeconds: agent.healthCheckTimeoutSeconds,
            failureThreshold: agent.healthCheckFailureThreshold,
        };
        if (agent.healthChechHttpGetPath) {
            return {
                httpGet: {
                    path: agent.healthChechHttpGetPath,
                    port: agent.healthCheckHttpPort ?? 80,
                    scheme: agent.healthCheckHttpScheme ?? undefined,
                    ...(agent.healthCheckHttpHeadersJson ? { httpHeaders: JSON.parse(agent.healthCheckHttpHeadersJson) } : {}),
                },
                ...probeSettings,
            };
        }
        return {
            tcpSocket: { port: agent.healthCheckTcpPort! },
            ...probeSettings,
        };
    }

    buildSandboxTemplateResource(agent: AgentSandboxTemplateConfig, deploymentInfo?: SandboxTemplateDeploymentInfo): SandboxTemplate {
        const effectiveImage = agent.containerImageSource;
        const secretName = KubeObjectNameUtils.toSecretId(agent.id);
        const customCommand = ContainerCommangArgsUtils.parseStoredContainerCommandArray(agent.containerCommand);
        const customArgs = agent.containerArgs ? JSON.parse(agent.containerArgs) : null;
        const usesDefaultOpenCodeStartup = !agent.containerCommand && !customArgs;
        const workingDir = agent.workingDir?.trim() || '/workspace';

        const hasCustomVolumes = agent.volumePvcData.length > 0;

        type SandboxVolumes = SandboxTemplate['spec']['podTemplate']['spec']['volumes']
        const workspaceVolumes = hasCustomVolumes
            ? agent.volumePvcData.map(v => v.volume)
            : [{
                name: 'workspace',
                emptyDir: {},
            }];
        const volumes = [...workspaceVolumes, ...agent.fileVolumes] as SandboxVolumes;

        const agentWorkspaceVolumeMounts = hasCustomVolumes
            ? agent.volumePvcData.map(v => v.volumeMount)
            : [{
                name: 'workspace',
                mountPath: workingDir,
            }];
        const agentVolumeMounts = [...agentWorkspaceVolumeMounts, ...agent.fileVolumeMounts] as V1VolumeMount[];

        const filebrowserVolumeMounts = hasCustomVolumes
            ? agent.volumePvcData.map(v => ({
                name: v.volume.name,
                mountPath: `/srv/${v.volumeMount.name}`,
            }))
            : [{
                name: 'workspace',
                mountPath: '/srv',
            }];
        const networkPolicy = networkPolicyService.buildAgentSandboxTemplateNetworkPolicy(agent.agentNetworkPolicy);
        const healthCheckProbe = this.buildHealthCheckProbe(agent);
        const annotations = {
            [Constants.QS_ANNOTATION_UPDATED_AT]: `${new Date().toISOString()}`,
            [Constants.QS_ANNOTATION_AGENT_ID]: agent.id,
            [Constants.QS_ANNOTATION_PROJECT_ID]: agent.projectId,
            ...(deploymentInfo?.deploymentId ? { [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: deploymentInfo.deploymentId } : {}),
            ...(deploymentInfo?.buildJobName ? { buildJobName: deploymentInfo.buildJobName } : {}),
            ...(deploymentInfo?.gitCommitHash ? { [Constants.QS_ANNOTATION_GIT_COMMIT]: deploymentInfo.gitCommitHash } : {}),
            ...(deploymentInfo?.gitCommitMessage ? { [Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE]: deploymentInfo.gitCommitMessage } : {}),
        };
        const labels = {
            [Constants.QS_ANNOTATION_AGENT_ID]: agent.id,
            [Constants.QS_ANNOTATION_PROJECT_ID]: agent.projectId,
        };

        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxTemplate',
            metadata: {
                name: agent.id,
                namespace: agent.projectId,
                annotations,
                labels
            },
            spec: {
                volumeClaimTemplatesPolicy: 'Disallowed', // Default by CRD
                envVarsInjectionPolicy: 'Disallowed',
                networkPolicyManagement: 'Managed',
                ...(networkPolicy ? { networkPolicy } : {}),
                service: true,
                podTemplate: {
                    metadata: {
                        annotations,
                        labels
                    },
                    spec: {
                        volumes,
                        ...(deploymentInfo?.dockerPullSecretName ? { imagePullSecrets: [{ name: deploymentInfo.dockerPullSecretName }] } : {}),
                        containers: [{
                            name: 'agent',
                            image: effectiveImage,
                            imagePullPolicy: 'Always',
                            ...(usesDefaultOpenCodeStartup
                                ? {}
                                : {
                                    ...(customCommand ? { command: customCommand } : {}),
                                    ...(customArgs ? { args: customArgs } : {}),
                                }),
                            workingDir: workingDir,
                            ports: agent.agentDomains.map((domain, index) => ({
                                name: `port-${index + 1}`,
                                containerPort: domain.port,
                                protocol: 'TCP',
                            })),
                            volumeMounts: agentVolumeMounts,
                            envFrom: [{ secretRef: { name: secretName } }],
                            ...(healthCheckProbe ? {
                                // Agent sandboxes intentionally use startup and readiness probes only.
                                // A liveness probe is not needed: startup gates initialization and
                                // readiness controls when sandbox traffic may be routed.
                                startupProbe: {
                                    ...healthCheckProbe,
                                    periodSeconds: 10,
                                    failureThreshold: 30,
                                    timeoutSeconds: 3,
                                },
                                readinessProbe: healthCheckProbe,
                            } : {}),
                            resources: {
                                requests: {
                                    ...(agent.cpuRequest ? {
                                        cpu: `${agent.cpuRequest}m`,
                                    } : {}),
                                    ...(agent.memoryRequest ? {
                                        memory: `${agent.memoryRequest}M`,
                                    } : {}),
                                },
                                limits: {
                                    ...(agent.cpuLimit ? {
                                        cpu: `${agent.cpuLimit}m`,
                                    } : {}),
                                    ...(agent.memoryLimit ? {
                                        memory: `${agent.memoryLimit}M`,
                                    } : {}),
                                },
                            },
                        }, ...(agent.deployFileBrowser ? [{
                            name: 'filebrowser',
                            image: 'filebrowser/filebrowser:v2.31.2',
                            imagePullPolicy: 'Always',
                            args: [
                                '--noauth',
                                '--root', '/srv',
                                '--baseurl', FILEBROWSER_BASE_URL,
                                '--port', `${FILEBROWSER_PORT}`,
                            ],
                            ports: [{
                                name: 'filebrowser-web',
                                containerPort: FILEBROWSER_PORT,
                                protocol: 'TCP',
                            }],
                            volumeMounts: filebrowserVolumeMounts,
                        }] : [])]
                    }
                }
            }
        };
    }

    buildSandboxWarmPoolResource(agentId: string, namespace: string, replicas: number): SandboxWarmPool {
        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxWarmPool',
            metadata: {
                name: agentId,
                namespace,
                annotations: {
                    [Constants.QS_ANNOTATION_UPDATED_AT]: `${new Date().getTime()}`,
                },
            },
            spec: {
                sandboxTemplateRef: {
                    name: agentId,
                },
                replicas,
            },
        };
    }

    buildSandboxClaimResource(
        sandboxName: string,
        namespace: string,
        warmPoolName: string,
        labels?: Record<string, string>,
        annotations?: Record<string, string>,
        options?: {
            env?: Record<string, string>;
            idleTimeoutMinutes?: number;
        },
    ): SandboxClaim {
        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxClaim',
            metadata: {
                name: sandboxName,
                namespace,
                ...(labels ? { labels } : {}),
                ...(annotations ? { annotations } : {}),
            },
            spec: {
                warmPoolRef: {
                    name: warmPoolName,
                },
                ...(options?.env ? {
                    env: Object.entries(options.env).map(([name, value]) => ({ name, value })),
                } : {}),
                ...(options?.idleTimeoutMinutes ? {
                    lifecycle: {
                        shutdownPolicy: 'Delete',
                        ttlSecondsAfterFinished: options.idleTimeoutMinutes * 60,
                    },
                } : {}),
            },
        };
    }
}

const agentSandboxTemplateBuilder = new AgentSandboxTemplateBuilder();
export default agentSandboxTemplateBuilder;
