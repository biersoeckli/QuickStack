// @vitest-environment node

vi.mock('@/server/services/param.service', () => ({
    default: {
        getOrCreateAgentJwtSecret: vi.fn().mockResolvedValue('test-secret'),
    },
}));

import { decodeJwt } from 'jose';
import { AuthProxyJwtUtils } from './agent-jwt.utils';

describe('AuthProxyJwtUtils', () => {
    it('adds a unique jti to every access token', async () => {
        const payload = {
            sub: 'user-1',
            agentId: 'agent-1',
            claimId: 'claim-1',
            namespace: 'project-1',
        };

        const [first, second] = await Promise.all([
            AuthProxyJwtUtils.signAgentAccessToken(payload),
            AuthProxyJwtUtils.signAgentAccessToken(payload),
        ]);
        const firstClaims = decodeJwt(first);
        const secondClaims = decodeJwt(second);

        expect(firstClaims.jti).toEqual(expect.any(String));
        expect(secondClaims.jti).toEqual(expect.any(String));
        expect(firstClaims.jti).not.toBe(secondClaims.jti);
    });
});
