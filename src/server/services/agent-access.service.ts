import { ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "@/shared/utils/constants";
import agentSandboxAdapter from "../adapter/agent-sandbox.adapter";
import agentDomainService from "./agent-domain.service";
import agentService from "./agent.service";
import { RequesterIdentity, ensureReadAgent } from "../utils/shared-authorization.utils";
import { UserSession } from "@/shared/model/sim-session.model";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";
import { AuthProxyJwtUtils } from "../utils/agent-jwt.utils";

export type AgentAccessView = 'agent' | 'files';

type CreateAgentAccessUrlInput = {
    agentId: string;
    claimName: string;
    domainId: string;
    view: AgentAccessView;
    session: UserSession;
};

class AgentAccessService {
    private resolveClaimStatus(claim: any): DeploymentStatus {
        const conditions: Array<{ type: string; status: string }> = claim?.status?.conditions || [];
        const ready = conditions.find((c) =>
            (c.type === 'Ready' || c.type === 'Available') && c.status === 'True',
        );
        if (ready) {
            return 'DEPLOYED';
        }

        const failed = conditions.find((c) =>
            (c.type === 'Ready' || c.type === 'Available') && c.status === 'False',
        );
        if (failed) {
            return 'ERROR';
        }

        return 'DEPLOYING';
    }

    async createAccessUrl(input: CreateAgentAccessUrlInput): Promise<{ url: string; expiresAt: number }> {
        const domain = await agentDomainService.getDomainForAgent(input.agentId, input.domainId);
        const target = await this.validateClaimAccess(input.agentId, input.claimName, input.session);

        const token = await AuthProxyJwtUtils.signAgentAccessToken({
            sub: input.session.email,
            agentId: input.agentId,
            claimId: input.claimName,
            namespace: target.namespace,
        });
        const protocol = domain.useSsl ? 'https' : 'http';
        const path = input.view === 'files' ? '/files' : '/';
        return {
            url: `${protocol}://${domain.hostname}${path}?token=${encodeURIComponent(token)}`,
            expiresAt: Math.floor(Date.now() / 1000) + Number(process.env.AGENT_JWT_TTL_SECONDS || '3600'),
        };
    }

    async validateClaimAccess(agentId: string, claimName: string, session: UserSession): Promise<{
        agentId: string;
        claimName: string;
        namespace: string;
    }> {
        const identity: RequesterIdentity = { type: 'session', session };
        ensureReadAgent(identity, agentId);

        const agent = await agentService.getById(agentId);
        const claim = await agentSandboxAdapter.getSandboxClaim(claimName, agent.projectId);
        if (!claim) {
            throw new ServiceException('Agent instance not found.');
        }
        const claimAgentId = claim.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID];
        if (claimAgentId !== agentId) {
            throw new ServiceException('Agent instance does not belong to this Agent.');
        }
        if (this.resolveClaimStatus(claim) !== 'DEPLOYED') {
            throw new ServiceException('Agent instance is not deployed.');
        }
        return {
            agentId,
            claimName,
            namespace: agent.projectId,
        };
    }

    async createSelectToken(input: CreateAgentAccessUrlInput) {
        return this.createAccessUrl(input);
    }
}

const agentAccessService = new AgentAccessService();
export default agentAccessService;
