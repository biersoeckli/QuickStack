import { ServiceException } from "@/shared/model/service.exception.model";
import agentDomainService from "./agent-domain.service";
import agentService from "./agent.service";
import { RequesterIdentity, ensureReadAgent } from "../utils/shared-authorization.utils";
import { UserSession } from "@/shared/model/sim-session.model";
import { AuthProxyJwtUtils } from "../utils/agent-jwt.utils";
import agentSandboxResolutionService from "./agent-sandbox-resolution.service";

export type AgentAccessView = 'agent' | 'files';

const agentApiTokenTtlSeconds = 15 * 60;

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

    async createApiToken(input: {
        agentId: string;
        sandboxName: string;
        domainId: string;
        session: UserSession;
    }): Promise<{ token: string; expiresAt: number }> {
        const domain = await agentDomainService.getDomainForAgent(input.agentId, input.domainId);
        const target = await this.validateSandboxAccess(input.agentId, input.sandboxName, input.session);
        const token = await AuthProxyJwtUtils.signAgentApiToken({
            agentId: input.agentId,
            claimId: input.sandboxName,
            namespace: target.namespace,
            port: domain.port,
        }, agentApiTokenTtlSeconds);

        return {
            token,
            expiresAt: Math.floor(Date.now() / 1000) + agentApiTokenTtlSeconds,
        };
    }

    private async validateSandboxAccess(agentId: string, sandboxName: string, session: UserSession): Promise<{
        agentId: string;
        sandboxName: string;
        namespace: string;
    }> {
        const identity: RequesterIdentity = { type: 'session', session };
        ensureReadAgent(identity, agentId);

        const agent = await agentService.getById(agentId);

        const agentSandbox = await agentSandboxResolutionService.resolve(agent, sandboxName);
        const status = agentSandbox.status;
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
}

const agentAccessService = new AgentAccessService();
export default agentAccessService;
