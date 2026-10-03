import type { AuthInfo } from '@modelcontextprotocol/server';
import { getIdentityFromApiKeyHeader } from '../utils/requester-identity.utils';

export type McpAuthResolver = (request: Request) => Promise<AuthInfo | null>;

export const resolveQuickStackAuthInfo: McpAuthResolver = async (request) => {
    const authorization = request.headers.get('authorization');
    const identity = await getIdentityFromApiKeyHeader(authorization);
    if (!identity || !authorization) {
        return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    return {
        token,
        clientId: identity.session.userId,
        scopes: [],
        extra: { identity },
    };
};
