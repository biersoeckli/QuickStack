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
import { ServiceException } from "@/shared/model/service.exception.model";

const OPENCODE_PROVIDER_ID = 'quickstack-litellm';

const OPENCODE_WORKDIR = '/workspace';
export const OPENCODE_WEB_PORT = 4096;
const FILEBROWSER_PORT = 80;
const FILEBROWSER_BASE_URL = '/files';

export type AgentSandboxTemplateConfig = {
    id: string;
    projectId: string;
    containerImageSource: string;
    modelAlias: string;
    llmGateway?: { baseUrl: string } | null;
    cpuRequest?: number | null;
    cpuLimit?: number | null;
    memoryRequest?: number | null;
    memoryLimit?: number | null;
    containerCommand?: string | null;
    containerArgs?: string | null;
    volumePvcData: {
        volume: V1Volume;
        volumeMount: V1VolumeMount;
    }[];
    fileVolumes: V1Volume[];
    fileVolumeMounts: V1VolumeMount[];
};

export type SandboxTemplateDeploymentInfo = {
    dockerPullSecretName?: string;
    deploymentId?: string;
    buildJobName?: string;
    gitCommitHash?: string;
    gitCommitMessage?: string;
};

class AgentSandboxTemplateBuilder {

    private normalizeLiteLlmBaseUrl(baseUrl: string): string {
        const trimmed = baseUrl.trim().replace(/\/+$/, '');
        if (!trimmed) {
            throw new ServiceException('LLM Gateway base URL is missing for Agent.');
        }
        return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
    }

    buildOpenCodeConfig(agent: AgentSandboxTemplateConfig) {
        const modelAlias = agent.modelAlias;
        return {
            $schema: 'https://opencode.ai/config.json',
            model: `${OPENCODE_PROVIDER_ID}/${modelAlias}`,
            provider: {
                [OPENCODE_PROVIDER_ID]: {
                    npm: '@ai-sdk/openai-compatible',
                    name: 'QuickStack LiteLLM',
                    options: {
                        baseURL: this.normalizeLiteLlmBaseUrl(agent.llmGateway?.baseUrl || ''),
                        apiKey: '{env:QS_VIRTUAL_KEY}',
                    },
                    models: {
                        [modelAlias]: {
                            name: modelAlias,
                        },
                    },
                },
            },
            server: {
                hostname: '0.0.0.0',
                port: OPENCODE_WEB_PORT,
            },
        };
    }

    buildSandboxTemplateResource(agent: AgentSandboxTemplateConfig, deploymentInfo?: SandboxTemplateDeploymentInfo): SandboxTemplate {
        const effectiveImage = agent.containerImageSource;
        const secretName = KubeObjectNameUtils.toSecretId(agent.id);
        const customCommand = ContainerCommangArgsUtils.parseStoredContainerCommandArray(agent.containerCommand);
        const customArgs = agent.containerArgs ? JSON.parse(agent.containerArgs) : null;
        const usesDefaultOpenCodeStartup = !agent.containerCommand && !customArgs;

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
                mountPath: OPENCODE_WORKDIR,
            }];
        const agentVolumeMounts = [...agentWorkspaceVolumeMounts, ...agent.fileVolumeMounts];

        const filebrowserVolumeMounts = hasCustomVolumes
            ? agent.volumePvcData.map(v => ({
                name: v.volume.name,
                mountPath: `/srv/${v.volumeMount.name}`,
            }))
            : [{
                name: 'workspace',
                mountPath: '/srv',
            }];

        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxTemplate',
            metadata: {
                name: agent.id,
                namespace: agent.projectId,
                annotations: {
                    [Constants.QS_ANNOTATION_UPDATED_AT]: `${new Date().toISOString()}`,
                    [Constants.QS_ANNOTATION_AGENT_ID]: agent.id,
                    [Constants.QS_ANNOTATION_PROJECT_ID]: agent.projectId,
                    ...(deploymentInfo?.deploymentId ? { [Constants.QS_ANNOTATION_DEPLOYMENT_ID]: deploymentInfo.deploymentId } : {}),
                    ...(deploymentInfo?.buildJobName ? { buildJobName: deploymentInfo.buildJobName } : {}),
                    ...(deploymentInfo?.gitCommitHash ? { [Constants.QS_ANNOTATION_GIT_COMMIT]: deploymentInfo.gitCommitHash } : {}),
                    ...(deploymentInfo?.gitCommitMessage ? { [Constants.QS_ANNOTATION_GIT_COMMIT_MESSAGE]: deploymentInfo.gitCommitMessage } : {}),
                },
            },
            spec: {
                envVarsInjectionPolicy: 'Disallowed',
                networkPolicyManagement: 'Managed',
                service: true,
                podTemplate: {
                    spec: {
                        volumes,
                        ...(deploymentInfo?.dockerPullSecretName ? { imagePullSecrets: [{ name: deploymentInfo.dockerPullSecretName }] } : {}),
                        containers: [{
                            name: 'agent',
                            image: effectiveImage,
                            ...(usesDefaultOpenCodeStartup
                                ? {
                                    command: ['/bin/sh', '-lc'],
                                    args: [`cd ${OPENCODE_WORKDIR} && exec opencode web --hostname 0.0.0.0 --port ${OPENCODE_WEB_PORT}`],
                                }
                                : {
                                    ...(customCommand ? { command: customCommand } : {}),
                                    ...(customArgs ? { args: customArgs } : {}),
                                }),
                            workingDir: OPENCODE_WORKDIR,
                            ports: [{
                                name: 'opencode-web',
                                containerPort: OPENCODE_WEB_PORT,
                                protocol: 'TCP',
                            }],
                            volumeMounts: agentVolumeMounts,
                            envFrom: [{ secretRef: { name: secretName } }],
                            env: [{
                                name: 'OPENCODE_CONFIG_CONTENT',
                                value: JSON.stringify(this.buildOpenCodeConfig(agent)),
                            }],
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
                        }, {
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
                        }]
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
        claimName: string,
        namespace: string,
        warmPoolName: string,
        labels?: Record<string, string>,
    ): SandboxClaim {
        return {
            apiVersion: `${SANDBOX_API_GROUP}/${SANDBOX_API_VERSION}`,
            kind: 'SandboxClaim',
            metadata: {
                name: claimName,
                namespace,
                ...(labels ? { labels } : {}),
            },
            spec: {
                warmPoolRef: {
                    name: warmPoolName,
                },
            },
        };
    }
}

const agentSandboxTemplateBuilder = new AgentSandboxTemplateBuilder();
export default agentSandboxTemplateBuilder;
