import { ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "@/shared/utils/constants";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import agentDomainService from "./agent-domain.service";
import agentService from "./agent.service";
import { RequesterIdentity, ensureReadAgent } from "../utils/shared-authorization.utils";
import { UserSession } from "@/shared/model/sim-session.model";
import { AuthProxyJwtUtils } from "../utils/agent-jwt.utils";
import { AgentVolumeUtils } from "../utils/agent-volume.utils";

export type AgentAccessView = 'agent' | 'files';

type CreateAgentAccessUrlInput = {
    agentId: string;
    sandboxName: string;
    domainId: string;
    view: AgentAccessView;
    session: UserSession;
};

class AgentAccessService {
    async createAccessUrl(input: CreateAgentAccessUrlInput): Promise<{ url: string; expiresAt: number }> {
        const domain = await agentDomainService.getDomainForAgent(input.agentId, input.domainId);
        const target = await this.validateSandboxAccess(input.agentId, input.sandboxName, input.session);

        const token = await AuthProxyJwtUtils.signAgentAccessToken({
            sub: input.session.email,
            agentId: input.agentId,
            claimId: input.sandboxName,
            namespace: target.namespace,
            port: domain.port,
        });
        const protocol = domain.useSsl ? 'https' : 'http';
        const path = input.view === 'files' ? '/files' : '/';
        return {
            url: `${protocol}://${domain.hostname}${path}?token=${encodeURIComponent(token)}`,
            expiresAt: Math.floor(Date.now() / 1000) + Number(30), // valid for 20 seconds
        };
    }

    async validateSandboxAccess(agentId: string, sandboxName: string, session: UserSession): Promise<{
        agentId: string;
        sandboxName: string;
        namespace: string;
    }> {
        const identity: RequesterIdentity = { type: 'session', session };
        ensureReadAgent(identity, agentId);

        const agent = await agentService.getById(agentId);

        if (AgentVolumeUtils.usesPerCustomTagVolume(agent.agentVolumes)) {
            const sandbox = await agentSandboxAdapter.getSandbox(sandboxName, agent.projectId);
            if (!sandbox) {
                throw new ServiceException('Agent sandbox not found.');
            }
            if (sandbox.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID] !== agentId) {
                throw new ServiceException('Agent sandbox does not belong to this Agent.');
            }
            const directStatus = agentSandboxAdapter.resolveSandboxObjectStatus(sandbox);
            if (directStatus === 'SUSPENDED') {
                throw new ServiceException('Agent sandbox is suspended. Resume it before requesting an access URL.');
            }
            if (directStatus !== 'DEPLOYED') {
                throw new ServiceException('Agent sandbox is not deployed.');
            }
            return {
                agentId,
                sandboxName,
                namespace: agent.projectId,
            };
        }

        const claim = await agentSandboxAdapter.getSandboxClaim(sandboxName, agent.projectId);
        if (!claim) {
            throw new ServiceException('Agent sandbox not found.');
        }
        const claimAgentId = claim.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID];
        if (claimAgentId !== agentId) {
            throw new ServiceException('Agent sandbox does not belong to this Agent.');
        }

        const sandboxObjectName = claim.status?.sandbox?.name;
        const sandbox = sandboxObjectName
            ? await agentSandboxAdapter.getSandbox(sandboxObjectName, agent.projectId)
            : null;
        const status = agentSandboxAdapter.resolveSandboxStatus(claim, sandbox);
        if (status === 'SUSPENDED') {
            throw new ServiceException('Agent sandbox is suspended. Resume it before requesting an access URL.');
        }
        if (status !== 'DEPLOYED') {
            throw new ServiceException('Agent sandbox is not deployed.');
        }
        return {
            agentId,
            sandboxName,
            namespace: agent.projectId,
        };
    }

    async createSelectToken(input: CreateAgentAccessUrlInput) {
        return this.createAccessUrl(input);
    }
}

const agentAccessService = new AgentAccessService();
export default agentAccessService;
