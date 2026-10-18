import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import k3s from "../adapter/kubernetes-api.adapter";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { ApiNotFoundException, ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "@/shared/utils/constants";
import { AgentSandboxUtils } from "../utils/agent-sandbox.utils";

type AgentSandboxResolutionAgent = {
    id: string;
    projectId: string;
    agentVolumes: { volumeType: string }[];
};

export type ResolvedAgentSandbox = {
    namespace: string;
    sandboxName: string;
    sandboxObjectName: string;
    podName: string;
    containerName: string;
    status: DeploymentStatus;
    createdAt: string | null;
    customTag?: string | null;
};

class AgentSandboxResolutionService {
    async resolve(
        agent: AgentSandboxResolutionAgent,
        sandboxName: string,
    ): Promise<ResolvedAgentSandbox> {
        const namespace = agent.projectId;
        if (AgentSandboxUtils.usesPerCustomTagVolume(agent.agentVolumes)) {
            return this.resolveDirectSandbox(agent.id, sandboxName, namespace);
        }
        return this.resolveClaimSandbox(agent.id, sandboxName, namespace);
    }

    async resolveWithPod(
        agent: AgentSandboxResolutionAgent,
        sandboxName: string,
    ): Promise<ResolvedAgentSandbox> {
        const target = await this.resolve(agent, sandboxName);
        if (target.status === 'SUSPENDED') {
            return target;
        }

        const sandbox = await agentSandboxAdapter.getSandbox(target.sandboxObjectName, target.namespace);
        if (!sandbox) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox runtime not found.');
        }
        const selector = sandbox.status?.selector;
        if (!selector) {
            throw new ServiceException('Agent sandbox pod selector not found.');
        }

        const pods = await k3s.core.listNamespacedPod({ namespace: target.namespace, labelSelector: selector });
        const pod = pods.items.find((item) => item.status?.phase === 'Running') ?? pods.items[0];
        const podName = pod?.metadata?.name;
        const containerName = pod?.spec?.containers?.[0]?.name;
        if (!podName || !containerName) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox pod not found.');
        }

        return { ...target, podName, containerName };
    }

    private async resolveDirectSandbox(
        agentId: string,
        sandboxName: string,
        namespace: string,
    ): Promise<ResolvedAgentSandbox> {
        const sandbox = await agentSandboxAdapter.getSandbox(sandboxName, namespace);
        if (!sandbox) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox not found.');
        }
        if (sandbox.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID] !== agentId) {
            throw new ServiceException('Agent sandbox does not belong to this Agent.');
        }

        return {
            namespace,
            sandboxName,
            sandboxObjectName: sandboxName,
            podName: '',
            containerName: '',
            status: AgentSandboxUtils.resolveSandboxObjectStatus(sandbox),
            createdAt: sandbox.metadata?.creationTimestamp ?? null,
            customTag: sandbox.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] ?? null,
        };
    }

    private async resolveClaimSandbox(
        agentId: string,
        sandboxName: string,
        namespace: string,
    ): Promise<ResolvedAgentSandbox> {
        const claim = await agentSandboxAdapter.getSandboxClaim(sandboxName, namespace);
        if (!claim) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox not found.');
        }
        if (claim.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID] !== agentId) {
            throw new ServiceException('Agent sandbox does not belong to this Agent.');
        }

        const sandboxObjectName = claim.status?.sandbox?.name;
        if (!sandboxObjectName) {
            throw new ServiceException('Agent sandbox is not ready.');
        }
        const sandbox = await agentSandboxAdapter.getSandbox(sandboxObjectName, namespace);
        if (!sandbox) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox runtime not found.');
        }

        return {
            namespace,
            sandboxName,
            sandboxObjectName,
            podName: '',
            containerName: '',
            status: AgentSandboxUtils.resolveSandboxStatus(claim, sandbox),
            createdAt: claim.metadata?.creationTimestamp ?? null,
            customTag: claim.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] ?? null,
        };
    }
}

const agentSandboxResolutionService = new AgentSandboxResolutionService();
export default agentSandboxResolutionService;
