// @vitest-environment node
import { createServer } from 'node:http';
import { io } from 'socket.io-client';
import { encode } from 'next-auth/jwt';
import socketIoServer from './socket-io.server';
import terminalService from './server/services/terminal.service';

vi.mock('@/server/services/terminal.service', () => ({
    default: { streamTerminal: vi.fn() },
}));

beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'terminal-test-secret');
    vi.stubEnv('NEXTAUTH_URL', 'http://quickstack.example');
    vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

async function connect(headers: Record<string, string> = {}, transport = 'websocket') {
    const server = createServer();
    const ioServer = socketIoServer.initialize(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const client = io(`http://127.0.0.1:${address.port}/pod-terminal`, {
        transports: [transport], reconnection: false, extraHeaders: headers,
    });
    try {
        return await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection did not settle')), 2000);
            client.on('connect', () => { clearTimeout(timeout); resolve('connected'); });
            client.on('connect_error', () => { clearTimeout(timeout); resolve('rejected'); });
        });
    } finally {
        client.disconnect();
        await new Promise<void>(resolve => ioServer.close(() => resolve()));
    }
}

it.each(['websocket', 'polling'])('rejects missing and forged sessions over %s', async transport => {
    expect(await connect({}, transport)).toBe('rejected');
    expect(await connect({ Cookie: 'next-auth.session-token=forged' }, transport)).toBe('rejected');
    expect(terminalService.streamTerminal).not.toHaveBeenCalled();
});

it.each(['websocket', 'polling'])('accepts a valid NextAuth cookie over %s', async transport => {
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { userId: 'user-1' } });
    expect(await connect({ Cookie: `next-auth.session-token=${token}` }, transport)).toBe('connected');
    expect(terminalService.streamTerminal).toHaveBeenCalledOnce();
});

it('accepts chunked secure cookies', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://quickstack.example');
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { userId: 'user-1' } });
    const split = Math.floor(token.length / 2);
    expect(await connect({ Cookie: `__Secure-next-auth.session-token.1=${token.slice(split)}; __Secure-next-auth.session-token.0=${token.slice(0, split)}` })).toBe('connected');
});

it('rejects expired sessions', async () => {
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { userId: 'user-1' }, maxAge: -60 });
    expect(await connect({ Cookie: `next-auth.session-token=${token}` })).toBe('rejected');
});

it('rejects a foreign browser Origin even with a valid cookie', async () => {
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { userId: 'user-1' } });
    expect(await connect({ Cookie: `next-auth.session-token=${token}`, Origin: 'https://attacker.example' })).toBe('rejected');
});
