import type http from 'node:http';
import { Server } from 'socket.io';
import { TerminalAuthUtils } from './server/utils/terminal-auth.utils';
import terminalService from './server/services/terminal.service';

class SocketIoServer {
    initialize(server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>) {
        const io = new Server(server);
        const terminalNamespace = io.of('/pod-terminal');
        terminalNamespace.use(async (socket, next) => {
            try {
                socket.data.terminalAuthentication = await TerminalAuthUtils.authenticate(socket.request);
                next();
            } catch {
                next(new Error('User is not authenticated.'));
            }
        });
        terminalNamespace.on('connection', (socket) => {
            void terminalService.streamTerminal(socket);
        });
        return io;
    }
}

const socketIoServer = new SocketIoServer();
export default socketIoServer;
