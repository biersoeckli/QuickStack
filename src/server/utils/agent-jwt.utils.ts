import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import paramService from "../services/param.service";

export interface AgentAccessTokenPayload {
    sub: string;
    agentId: string;
    claimId: string;
    namespace: string;
    jti?: string;
}

export class AuthProxyJwtUtils {
    private static readonly authProxyIssues = 'quickstack-auth-proxy';
    private static readonly algorithm = 'HS256';

    private static async getAgentJwtSecret(): Promise<Uint8Array> {
        const secret = await paramService.getOrCreateAgentJwtSecret();
        return Buffer.from(secret);
    }

    private static getTokenTtlSeconds(): number {
        const ttl = Number(process.env.AGENT_ACCESS_TOKEN_TTL_SECONDS || '60');
        return Number.isFinite(ttl) && ttl > 0 ? ttl : 60;
    }

    static async signAgentAccessToken(payload: AgentAccessTokenPayload): Promise<string> {
        return new SignJWT({ agentId: payload.agentId, claimId: payload.claimId, namespace: payload.namespace })
            .setProtectedHeader({ alg: AuthProxyJwtUtils.algorithm })
            .setSubject(payload.sub)
            .setIssuer(AuthProxyJwtUtils.authProxyIssues)
            .setJti(randomUUID())
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
            || typeof payload.jti !== 'string'
        ) {
            throw new Error('Invalid Agent access token payload.');
        }

        return {
            sub: payload.sub,
            agentId: payload.agentId,
            claimId: payload.claimId,
            namespace: payload.namespace,
            jti: payload.jti,
        };
    }
}
