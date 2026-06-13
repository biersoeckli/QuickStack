import crypto from 'crypto';

const API_KEY_HMAC_PREFIX = 'api-key:';

export class ApiKeyHashUtils {
    static hashApiKey(rawApiKey: string) {
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
            throw new Error('NEXTAUTH_SECRET environment variable is not set.');
        }

        return crypto
            .createHmac('sha256', secret)
            .update(`${API_KEY_HMAC_PREFIX}${rawApiKey}`)
            .digest('hex');
    }
}
