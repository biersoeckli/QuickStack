import { terminalSetupInfoZodModel } from '../../shared/model/terminal-setup-info.model';
import type { Socket } from 'socket.io';
import k3s from '../adapter/kubernetes-api.adapter';
import * as k8s from '@kubernetes/client-node';
import stream from 'node:stream';
import { StreamUtils } from '../../shared/utils/stream.utils';
import terminalAccessService from './terminal-access.service';
import standalonePodService from './standalone-services/standalone-pod.service';
import { ServiceException } from '../../shared/model/service.exception.model';
import { Constants } from '../../shared/utils/constants';
import type { TerminalAuthentication } from '../utils/terminal-auth.utils';

export class TerminalService {
    async streamTerminal(socket: Socket) {
        const authentication = socket.data.terminalAuthentication as TerminalAuthentication | undefined;
        if (!authentication || authentication.expiresAt <= Date.now()) {
            socket.disconnect(true);
            return;
        }
        const sessions = new Map<string, () => void>();
        let disconnected = false;
        let openingWindow = Date.now();
        let openings = 0;

        socket.on('openTerminal', async (podInfo: unknown) => {
            const parsed = terminalSetupInfoZodModel.safeParse(podInfo);
            if (!parsed.success || !parsed.data.terminalSessionKey || parsed.data.terminalSessionKey.length > 512) {
                return;
            }
            const info = parsed.data;
            const key = info.terminalSessionKey!;
            const inputKey = StreamUtils.getInputStreamName(info);
            const outputKey = StreamUtils.getOutputStreamName(info);
            if (disconnected || sessions.has(key) || sessions.size >= Constants.TERMINAL_MAX_SESSIONS_PER_SOCKET) {
                return;
            }
            if (Date.now() - openingWindow >= 60000) {
                openingWindow = Date.now();
                openings = 0;
            }
            if (++openings > Constants.TERMINAL_MAX_OPENS_PER_MINUTE) {
                return;
            }
            let closed = false;
            let websocket: Awaited<ReturnType<k8s.Exec['exec']>> | undefined;
            let timer: ReturnType<typeof setInterval> | undefined;
            let expiry: ReturnType<typeof setTimeout> | undefined;
            let onInput: ((data: unknown) => Promise<void>) | undefined;
            const stdout = new stream.PassThrough();
            const stderr = new stream.PassThrough();
            const stdin = new stream.PassThrough();
            const cleanup = () => {
                if (closed) {
                    return;
                }
                closed = true;
                sessions.delete(key);
                clearInterval(timer);
                clearTimeout(expiry);
                if (onInput) {
                    socket.off(inputKey, onInput);
                }
                stdout.destroy();
                stderr.destroy();
                stdin.destroy();
                websocket?.close();
            };
            sessions.set(key, cleanup);
            const deny = () => {
                if (!closed) {
                    socket.emit(outputKey, '\n[ERROR] Terminal session or action is not authorized or no longer available.\n');
                }
                cleanup();
            };
            try {
                const target = await terminalAccessService.authorize(authentication, info);
                if (closed) {
                    return;
                }
                const reachable = await standalonePodService.waitUntilPodIsRunningFailedOrSucceded(info.namespace, info.podName);
                if (closed) {
                    return;
                }
                if (!reachable) {
                    socket.emit(outputKey, 'Pod is not reachable.');
                    cleanup();
                    return;
                }
                const revalidate = async () => {
                    const current = await terminalAccessService.authorize(authentication, info);
                    if (current.podUid !== target.podUid || current.workloadId !== target.workloadId) {
                        throw new ServiceException('Terminal target changed.');
                    }
                };
                await revalidate();
                if (closed) {
                    return;
                }
                const remaining = Math.min(authentication.expiresAt - Date.now(), Constants.TERMINAL_MAX_DURATION_MS);
                if (remaining <= 0) {
                    deny();
                    return;
                }
                expiry = setTimeout(deny, remaining);
                timer = setInterval(() => {
                    void revalidate().catch(deny);
                }, Constants.TERMINAL_REVALIDATION_INTERVAL_MS);
                expiry.unref?.();
                timer.unref?.();
                const emitOutput = (chunk: Buffer) => {
                    if (Date.now() >= authentication.expiresAt) {
                        deny();
                        return;
                    }
                    if (!closed) {
                        socket.emit(outputKey, chunk.toString());
                    }
                };
                stdout.on('data', emitOutput);
                stderr.on('data', emitOutput);
                let inputQueue = Promise.resolve();
                let queuedBytes = 0;
                onInput = async (data: unknown) => {
                    if (closed || typeof data !== 'string' || data.length === 0) {
                        return;
                    }
                    const bytes = Buffer.byteLength(data);
                    if (bytes > Constants.TERMINAL_MAX_INPUT_BYTES
                        || queuedBytes + bytes > Constants.TERMINAL_MAX_QUEUED_INPUT_BYTES) {
                        deny();
                        return;
                    }
                    queuedBytes += bytes;
                    inputQueue = inputQueue.then(async () => {
                        if (closed) {
                            queuedBytes -= bytes;
                            return;
                        }
                        try {
                            await revalidate();
                            if (!closed) {
                                stdin.write(data);
                            }
                        } catch {
                            deny();
                        } finally {
                            queuedBytes -= bytes;
                        }
                    });
                    await inputQueue;
                };
                socket.on(inputKey, onInput);
                const command = info.terminalType === 'sh' ? '/bin/sh'
                    : info.terminalType === 'opencode' ? 'opencode' : '/bin/bash';
                websocket = await new k8s.Exec(k3s.getKubeConfig()).exec(
                    info.namespace, info.podName, info.containerName, [command],
                    stdout, stderr, stdin, true,
                    (status: k8s.V1Status) => {
                        if (!closed) {
                            socket.emit(outputKey, status.status === 'Failure'
                                ? '\n[ERROR] Error while opening Terminal session\n'
                                : '\n[INFO] Terminal session closed\n');
                        }
                        cleanup();
                    },
                );
                // Disconnect or close may have happened while exec was opening.
                if (closed) {
                    websocket.close();
                } else {
                    websocket.on('close', cleanup);
                    websocket.on('error', deny);
                }
            } catch {
                deny();
            }
        });
        socket.on('closeTerminal', (podInfo: unknown) => {
            const parsed = terminalSetupInfoZodModel.safeParse(podInfo);
            if (parsed.success && parsed.data.terminalSessionKey) {
                sessions.get(parsed.data.terminalSessionKey)?.();
            }
        });
        socket.on('disconnecting', () => {
            disconnected = true;
            for (const close of sessions.values()) {
                close();
            }
        });
    }
}

const terminalService = new TerminalService();
export default terminalService;
