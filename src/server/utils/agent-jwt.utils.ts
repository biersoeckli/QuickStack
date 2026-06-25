import { SignJWT, jwtVerify } from "jose";
import paramService from "../services/param.service";

export interface AgentAccessTokenPayload {
    sub: string;
    agentId: string;
    claimId: string;
    namespace: string;
}

export class AuthProxyJwtUtils {
    private static readonly authProxyIssues = 'quickstack-auth-proxy';
    private static readonly algorithm = 'HS256';

    private static async getAgentJwtSecret(): Promise<Uint8Array> {
        const secret = await paramService.getOrCreateAgentJwtSecret();
        return new TextEncoder().encode(secret);
    }

    private static getTokenTtlSeconds(): number {
        const ttl = Number(process.env.AGENT_JWT_TTL_SECONDS || '3600');
        return Number.isFinite(ttl) && ttl > 0 ? ttl : 3600;
    }

    static async signAgentAccessToken(payload: AgentAccessTokenPayload): Promise<string> {
        return new SignJWT({ agentId: payload.agentId, claimId: payload.claimId, namespace: payload.namespace })
            .setProtectedHeader({ alg: AuthProxyJwtUtils.algorithm })
            .setSubject(payload.sub)
            .setIssuer(AuthProxyJwtUtils.authProxyIssues)
            .setIssuedAt()
            .setExpirationTime(`${AuthProxyJwtUtils.getTokenTtlSeconds()}s`)
            .sign(await AuthProxyJwtUtils.getAgentJwtSecret());
    }

    static async verifyAgentAccessToken(token: string): Promise<AgentAccessTokenPayload> {
        const { payload } = await jwtVerify(token, await AuthProxyJwtUtils.getAgentJwtSecret(), {
            issuer: AuthProxyJwtUtils.authProxyIssues,
            algorithms: [AuthProxyJwtUtils.algorithm],
        });

        if (
            typeof payload.sub !== 'string' ||
            typeof payload.agentId !== 'string' ||
            typeof payload.claimId !== 'string' ||
            typeof payload.namespace !== 'string'
        ) {
            throw new Error('Invalid Agent access token payload.');
        }

        return {
            sub: payload.sub,
            agentId: payload.agentId,
            claimId: payload.claimId,
            namespace: payload.namespace,
        };
    }
}
