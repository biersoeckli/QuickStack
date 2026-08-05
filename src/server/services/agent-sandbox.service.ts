import stream from "stream";
import * as k8s from "@kubernetes/client-node";
import k3s from "@/server/adapter/kubernetes-api.adapter";
import agentSandboxAdapter from "@/server/adapter/agent-sandbox.adapter";
import agentRuntimeService from "@/server/services/agent-runtime.service";
import agentService from "@/server/services/agent.service";
import {
    AgentSandboxModel,
    CommandResultModel,
    CommandRequestModel,
    CreateSandboxRequestModel,
    FileEntryModel,
    FileExistsResultModel,
} from "@/shared/model/agent-sandbox.model";
import { ApiNotFoundException, ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "@/shared/utils/constants";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";

type ResolvedSandboxTarget = {
    namespace: string;
    sandboxName: string;
    sandboxObjectName: string;
    podName: string;
    containerName: string;
    status: DeploymentStatus;
    createdAt: string | null;
    customTag?: string | null;
};

class AgentSandboxService {
    // Path validation is not a security boundary: all file/command endpoints require
    // write access to the agent, which already grants unrestricted shell read/write
    // access in this sandbox. Container isolation is the real boundary.
    private resolveClaimStatus(claim: any): DeploymentStatus {
        const conditions: Array<{ type: string; status: string }> = claim?.status?.conditions || [];
        const ready = conditions.find((c) =>
            (c.type === 'Ready' || c.type === 'Available') && c.status === 'True',
        );
        if (ready) {
            return 'DEPLOYED';
        }

        const failed = conditions.find((c) =>
            (c.type === 'Ready' || c.type === 'Available') && c.status === 'False',
        );
        if (failed) {
            return 'ERROR';
        }

        return 'DEPLOYING';
    }

    private shellQuote(value: string): string {
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

    private validateEnvName(name: string): void {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            throw new ServiceException(`Invalid environment variable name "${name}".`);
        }
    }

    private buildShellScript(command: string, options?: Pick<CommandRequestModel, 'cwd' | 'timeoutSec' | 'env'>): string {
        const parts: string[] = [];

        if (options?.cwd) {
            parts.push(`cd ${this.shellQuote(options.cwd)}`);
        }

        const envPrefix = Object.entries(options?.env ?? {}).map(([name, value]) => {
            this.validateEnvName(name);
            return `${name}=${this.shellQuote(value)}`;
        }).join(' ');

        const timeoutSec = options?.timeoutSec ?? 120;
        const commandPrefix = `timeout ${timeoutSec}s sh -lc ${this.shellQuote(command)}`;

        parts.push(`${envPrefix ? `${envPrefix} ` : ''}${commandPrefix}`);
        return parts.join(' && ');
    }

    private extractExitCode(status: any): number {
        if (status?.status !== 'Failure') {
            return 0;
        }
        const exitCodeCause = status?.details?.causes?.find((cause: any) => cause.reason === 'ExitCode');
        const parsed = Number.parseInt(exitCodeCause?.message ?? '', 10);
        return Number.isFinite(parsed) ? parsed : 1;
    }

    private async getAgentNamespace(agentId: string): Promise<string> {
        const agent = await agentService.getByIdOrUndefined(agentId);
        if (!agent) {
            throw new ApiNotFoundException('Not Found', 'Agent not found.');
        }
        return agent.projectId;
    }

    private async getClaimForAgent(agentId: string, sandboxName: string, namespace: string) {
        const claim = await agentSandboxAdapter.getSandboxClaim(sandboxName, namespace);
        if (!claim) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox not found.');
        }

        const claimAgentId = claim.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID];
        if (claimAgentId !== agentId) {
            throw new ServiceException('Agent sandbox does not belong to this Agent.');
        }

        return claim;
    }

    private async resolveTarget(agentId: string, sandboxName: string): Promise<ResolvedSandboxTarget> {
        const namespace = await this.getAgentNamespace(agentId);
        const claim = await this.getClaimForAgent(agentId, sandboxName, namespace);
        const sandboxObjectName = claim.status?.sandbox?.name;
        if (!sandboxObjectName) {
            throw new ServiceException('Agent sandbox is not ready.');
        }

        const sandbox = await agentSandboxAdapter.getSandbox(sandboxObjectName, namespace);
        if (!sandbox) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox runtime not found.');
        }

        const selector = sandbox.status?.selector;
        if (!selector) {
            throw new ServiceException('Agent sandbox pod selector not found.');
        }

        const pods = await k3s.core.listNamespacedPod({ namespace, labelSelector: selector });
        const pod = pods.items.find((item) => item.status?.phase === 'Running') ?? pods.items[0];
        const podName = pod?.metadata?.name;
        const containerName = pod?.spec?.containers?.[0]?.name;
        if (!podName || !containerName) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox pod not found.');
        }

        return {
            namespace,
            sandboxName,
            sandboxObjectName,
            podName,
            containerName,
            status: this.resolveClaimStatus(claim),
            createdAt: claim.metadata?.creationTimestamp ?? null,
            customTag: claim.metadata?.annotations?.[Constants.QS_ANNOTATION_CUSTOM_TAG] ?? null,
        };
    }

    private toSandboxModel(agentId: string, target: ResolvedSandboxTarget): AgentSandboxModel {
        return {
            agentId,
            sandboxName: target.sandboxName,
            podName: target.podName,
            namespace: target.namespace,
            status: target.status,
            createdAt: target.createdAt,
            customTag: target.customTag ?? null,
        };
    }

    private async runExec(
        target: ResolvedSandboxTarget,
        command: string[],
        stdoutStream: stream.PassThrough,
        stderrStream: stream.PassThrough,
        stdinStream: stream.Readable | null,
        timeoutSec: number,
        onStatus: (status: k8s.V1Status) => void,
        onError: (error: Error) => void,
    ): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            let streamsClosed = false;
            let ws: { close: () => void; once?: (event: string, listener: () => void) => void } | undefined;
            const finish = (callback: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                callback();
                resolve();
            };
            const timer = setTimeout(() => {
                finish(() => {
                    stdoutStream.destroy();
                    stderrStream.destroy();
                    onError(new ServiceException('Command execution timed out or the sandbox connection was lost.'));
                });
            }, (timeoutSec + 5) * 1000);
            const closeConnection = () => {
                streamsClosed = true;
                ws?.close();
            };
            stdoutStream.once('close', closeConnection);
            stdinStream?.once('close', () => {
                // A normal stdin end closes only the Kubernetes exec stdin channel.
                // Keep the WebSocket open until the status callback arrives; otherwise
                // successful uploads wait for the command timeout before returning.
                if (!stdinStream.readableEnded) closeConnection();
            });

            const exec = new k8s.Exec(k3s.getKubeConfig());
            exec.exec(
                target.namespace,
                target.podName,
                target.containerName,
                command,
                stdoutStream,
                stderrStream,
                stdinStream,
                false,
                (status: k8s.V1Status) => {
                    finish(() => onStatus(status));
                },
            ).then((connection) => {
                ws = connection;
                if (streamsClosed) ws.close();
                ws.once?.('close', () => {
                    if (!settled && !streamsClosed) {
                        finish(() => {
                            const error = new ServiceException('Command execution connection was closed.');
                            stdoutStream.destroy(error);
                            stderrStream.destroy(error);
                            onError(error);
                        });
                    }
                });
            }).catch((error: unknown) => finish(() => onError(error instanceof Error ? error : new Error(String(error)))));
        });
    }

    private async execInTarget(
        target: ResolvedSandboxTarget,
        command: string[],
        timeoutSec = 120,
        stdinStream: stream.Readable | null = null,
    ): Promise<CommandResultModel> {
        const stdoutStream = new stream.PassThrough(); const stderrStream = new stream.PassThrough();
        let stdout = ''; let stderr = '';
        stdoutStream.on('data', (chunk) => { stdout += chunk.toString(); });
        stderrStream.on('data', (chunk) => { stderr += chunk.toString(); });
        return new Promise((resolve, reject) => void this.runExec(target, command, stdoutStream, stderrStream, stdinStream, timeoutSec,
            (status) => resolve({ stdout, stderr, exitCode: this.extractExitCode(status) }), reject));
    }

    private async execShell(
        target: ResolvedSandboxTarget,
        command: string,
        timeoutSec = 120,
        stdinStream: stream.Readable | null = null,
    ): Promise<CommandResultModel> {
        return this.execInTarget(target, ['sh', '-lc', command], timeoutSec, stdinStream);
    }

    private streamShellOutput(target: ResolvedSandboxTarget, command: string, timeoutSec = 120): stream.PassThrough {
        const stdoutStream = new stream.PassThrough();
        const stderrStream = new stream.PassThrough();
        let stderr = '';
        stderrStream.on('data', (chunk) => { stderr += chunk.toString(); });
        void this.runExec(target, ['sh', '-lc', command], stdoutStream, stderrStream, null, timeoutSec,
            (status) => this.extractExitCode(status) !== 0
                ? stdoutStream.destroy(new ServiceException(`Read file failed: ${stderr || 'command failed'}`))
                : stdoutStream.end(),
            (error) => stdoutStream.destroy(error));
        return stdoutStream;
    }

    private assertSuccessful(result: CommandResultModel, action: string): void {
        if (result.exitCode !== 0) {
            throw new ServiceException(`${action} failed: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`);
        }
    }

    private async getFileSize(target: ResolvedSandboxTarget, path: string): Promise<number> {
        const quotedPath = this.shellQuote(path);
        const metadata = await this.execShell(target, `if [ -f ${quotedPath} ]; then wc -c < ${quotedPath}; else exit 66; fi`);
        if (metadata.exitCode === 66) {
            throw new ApiNotFoundException('Not Found', 'File not found.');
        }
        this.assertSuccessful(metadata, 'Read file metadata');
        const size = Number.parseInt(metadata.stdout.trim(), 10);
        if (!Number.isSafeInteger(size) || size < 0) {
            throw new ServiceException('Read file metadata failed: invalid file size.');
        }
        return size;
    }

    async createSandbox(agentId: string, userId: string, timeoutMs: number, input: CreateSandboxRequestModel = {}): Promise<AgentSandboxModel> {
        const { sandboxName } = await agentRuntimeService.startSandbox(agentId, userId, {
            timeoutMs,
            ...input,
        });
        return this.getSandbox(agentId, sandboxName);
    }

    async listSandboxes(agentId: string): Promise<AgentSandboxModel[]> {
        const namespace = await this.getAgentNamespace(agentId);
        const claims = await agentRuntimeService.listSandboxes(agentId);
        const sandboxes: AgentSandboxModel[] = [];

        for (const claim of claims) {
            try {
                sandboxes.push(await this.getSandbox(agentId, claim.name));
            } catch (error) {
                const claimResource = await agentSandboxAdapter.getSandboxClaim(claim.name, namespace);
                const sandboxName = claimResource?.status?.sandbox?.name;
                if (sandboxName) {
                    throw error;
                }
                sandboxes.push({
                    agentId,
                    sandboxName: claim.name,
                    podName: '',
                    namespace: claim.namespace,
                    status: claim.status,
                    createdAt: claim.createdAt,
                    customTag: claim.customTag ?? null,
                });
            }
        }

        return sandboxes;
    }

    async getSandbox(agentId: string, sandboxName: string): Promise<AgentSandboxModel> {
        const target = await this.resolveTarget(agentId, sandboxName);
        return this.toSandboxModel(agentId, target);
    }

    async deleteSandbox(agentId: string, sandboxName: string): Promise<void> {
        await this.getSandbox(agentId, sandboxName);
        await agentRuntimeService.stopSandbox(agentId, sandboxName);
    }

    async runCommand(agentId: string, sandboxName: string, input: CommandRequestModel): Promise<CommandResultModel> {
        const target = await this.resolveTarget(agentId, sandboxName);
        const timeoutSec = input.timeoutSec ?? 120;
        return this.execShell(target, this.buildShellScript(input.command, { ...input, timeoutSec }), timeoutSec);
    }

    async readFile(agentId: string, sandboxName: string, path: string): Promise<{ stream: stream.PassThrough; size: number }> {
        const target = await this.resolveTarget(agentId, sandboxName);
        const size = await this.getFileSize(target, path);

        return {
            stream: this.streamShellOutput(target, `cat ${this.shellQuote(path)}`),
            size,
        };
    }

    async writeFile(agentId: string, sandboxName: string, path: string, input: stream.Readable): Promise<void> {
        const target = await this.resolveTarget(agentId, sandboxName);
        const result = await this.execShell(
            target,
            `cat > ${this.shellQuote(path)}`,
            120,
            input,
        );
        this.assertSuccessful(result, 'Write file');
    }

    async listFiles(agentId: string, sandboxName: string, path: string): Promise<FileEntryModel[]> {
        const target = await this.resolveTarget(agentId, sandboxName);
        const quotedPath = this.shellQuote(path);
        const script = [
            `target=${quotedPath}`,
            'if [ ! -d "$target" ]; then echo "not a directory" >&2; exit 64; fi',
            'for p in "$target"/* "$target"/.[!.]* "$target"/..?*; do',
            '  [ -e "$p" ] || continue',
            '  type=other',
            '  [ -d "$p" ] && type=directory',
            '  [ -f "$p" ] && type=file',
            '  size=0',
            '  [ "$type" = file ] && size=$(wc -c < "$p" 2>/dev/null || printf "0")',
            '  printf "%s\\0%s\\0%s\\0%s\\0" "$(basename "$p")" "$p" "$type" "$size"',
            'done',
        ].join('\n');
        const result = await this.execShell(target, script);
        this.assertSuccessful(result, 'List files');

        const fields = result.stdout.split('\0');
        if (fields.at(-1) === '') fields.pop();

        if (fields.length % 4 !== 0) {
            throw new ServiceException('List files failed: invalid output from sandbox.');
        }

        const files: FileEntryModel[] = [];
        for (let index = 0; index < fields.length; index += 4) {
            const [name, filePath, type, size] = fields.slice(index, index + 4);
            files.push({
                name,
                path: filePath,
                type: type === 'directory' || type === 'file' ? type : 'other',
                size: Number.parseInt(size, 10) || 0,
            });
        }

        return files;
    }

    async fileExists(agentId: string, sandboxName: string, path: string): Promise<FileExistsResultModel> {
        const target = await this.resolveTarget(agentId, sandboxName);
        const result = await this.execShell(target, `test -e ${this.shellQuote(path)}`);
        return { exists: result.exitCode === 0 };
    }
}

const agentSandboxService = new AgentSandboxService();
export default agentSandboxService;
