import type { IncomingMessage } from 'node:http';
import { getToken } from 'next-auth/jwt';
import { ServiceException } from '@/shared/model/service.exception.model';

export type TerminalAuthentication = {
    userId: string;
    expiresAt: number;
};

export class TerminalAuthUtils {
    static async authenticate(request: IncomingMessage): Promise<TerminalAuthentication> {
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) {
            throw new ServiceException('Terminal authentication is unavailable.');
        }
        const origin = request.headers.origin;
        if (origin && process.env.NEXTAUTH_URL && origin !== new URL(process.env.NEXTAUTH_URL).origin) {
            throw new ServiceException('Terminal origin is not allowed.');
        }
        const cookies: Record<string, string> = {};
        for (const part of (request.headers.cookie ?? '').split(';')) {
            const separator = part.indexOf('=');
            if (separator > 0) {
                cookies[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
            }
        }
        // Supply parsed cookies explicitly: Socket.IO uses a raw Node request.
        const token = await getToken({ req: Object.assign(request, { cookies }), secret });
        if (typeof token?.userId !== 'string' || typeof token.exp !== 'number'
            || token.exp * 1000 <= Date.now()) {
            throw new ServiceException('User is not authenticated.');
        }
        return { userId: token.userId, expiresAt: token.exp * 1000 };
    }
}
