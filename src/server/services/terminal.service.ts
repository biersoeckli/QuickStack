import { TerminalSetupInfoModel, terminalSetupInfoZodModel } from "../../shared/model/terminal-setup-info.model";
import { DefaultEventsMap, Socket } from "socket.io";
import k3s from "../adapter/kubernetes-api.adapter";
import * as k8s from '@kubernetes/client-node';
import stream from 'stream';
import { StreamUtils } from "../../shared/utils/stream.utils";
import WebSocket from "ws";
import standalonePodService from "./standalone-services/standalone-pod.service";

interface TerminalStrean {
    stdoutStream: stream.PassThrough;
    stderrStream: stream.PassThrough;
    stdinStream: stream.PassThrough;
    terminalSessionKey: string;
    websocket?: WebSocket.WebSocket;
}

export class TerminalService {
    activeStreams = new Map<string, { logStream: stream.PassThrough, clients: number, k3sStreamRequest: any }>();

    async streamTerminal(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
        console.log('[NEW] Client connected:', socket.id);

        const streamsOfSocket: TerminalStrean[] = [];

        socket.on('openTerminal', async (podInfo) => {
            console.warn('openTerminal', podInfo);
            try {
                const terminalInfo = terminalSetupInfoZodModel.parse(podInfo);
                if (!terminalInfo.terminalSessionKey) {
                    console.warn('terminalSessionKey not provided. Setting as undefined.');
                }
                console.log(terminalInfo)
                const streamInputKey = StreamUtils.getInputStreamName(terminalInfo);
                const streamOutputKey = StreamUtils.getOutputStreamName(terminalInfo);

                const podReachable = await standalonePodService.waitUntilPodIsRunningFailedOrSucceded(terminalInfo.namespace, terminalInfo.podName);
                if (!podReachable) {
                    socket.emit(streamOutputKey, 'Pod is not reachable.');
                    return;
                }

                const exec = new k8s.Exec(k3s.getKubeConfig());

                const stdoutStream = new stream.PassThrough();
                const stderrStream = new stream.PassThrough();
                const stdinStream = new stream.PassThrough();

                const socketStreamInfo = {
                    stdoutStream,
                    stderrStream,
                    stdinStream,
                    terminalSessionKey: terminalInfo.terminalSessionKey ?? '',
                } as TerminalStrean;
                streamsOfSocket.push(socketStreamInfo);

                const websocket = await exec.exec(
                    terminalInfo.namespace,
                    terminalInfo.podName,
                    terminalInfo.containerName,
                    [terminalInfo.terminalType === 'sh' ? '/bin/sh' : '/bin/bash'],
                    stdoutStream,
                    stderrStream,
                    stdinStream,
                    true /* tty */,
                    (status: k8s.V1Status) => {
                        console.log('[EXIT] Exited with status:');
                        console.log(JSON.stringify(status, null, 2));
                        if (status.status === 'Failure') {
                            socket.emit(streamOutputKey, `\n[ERROR] Error while opening Terminal session\n`);
                            socket.emit(streamOutputKey, `\n${status.message}\n`);
                        } else {
                            socket.emit(streamOutputKey, `\n[INFO] Terminal session closed\n`);
                        }
                        this.cleanupLogStream(socketStreamInfo);
                    },
                );
                socketStreamInfo.websocket = websocket;

                stdoutStream.on('data', (chunk) => {
                    socket.emit(streamOutputKey, chunk.toString());
                });
                stderrStream.on('data', (chunk) => {
                    console.log(chunk)
                    socket.emit(streamOutputKey, chunk.toString());
                });
                socket.on(streamInputKey, (data) => {
                    stdinStream!.write(data);
                });

                console.log(`Client ${socket.id} joined terminal stream for:`);
                console.log(`Input:  ${streamInputKey}`);
                console.log(`Output: ${streamOutputKey}`);
            } catch (error) {
                console.error('Error while initializing terminal session', podInfo, error);
            }
        });

        socket.on('closeTerminal', (podInfo) => {
            console.warn('closeTerminal', podInfo);
            const terminalInfo = terminalSetupInfoZodModel.parse(podInfo);

            const streams = streamsOfSocket.find(stream => stream.terminalSessionKey === terminalInfo.terminalSessionKey);
            if (streams) {
                this.cleanupLogStream(streams);
            }
        });

        socket.on('disconnecting', () => {
            // Stop all log streams for this client
            for (const stream of streamsOfSocket) {
                this.cleanupLogStream(stream);
            }
        });
    }


    private cleanupLogStream(stream: TerminalStrean) {
        stream.stderrStream.end();
        stream.stdoutStream.end();
        stream.stdinStream.end();
        stream.websocket?.close();
        console.log(`Stopped terminal stream for ${stream.terminalSessionKey}.`);
    }
}

const terminalService = new TerminalService();
export default terminalService;