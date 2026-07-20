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
    FileReadResultModel,
    FileTextReadResultModel,
} from "@/shared/model/agent-sandbox.model";
import { ApiNotFoundException, ServiceException } from "@/shared/model/service.exception.model";
import { Constants } from "@/shared/utils/constants";
import { DeploymentStatus } from "@/shared/model/deployment-info.model";

type ResolvedSandboxTarget = {
    namespace: string;
    claimName: string;
    sandboxName: string;
    podName: string;
    containerName: string;
    status: DeploymentStatus;
    createdAt: string | null;
    customTag?: string | null;
};

class AgentSandboxService {
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

        const commandPrefix = options?.timeoutSec
            ? `timeout ${options.timeoutSec}s sh -lc ${this.shellQuote(command)}`
            : `sh -lc ${this.shellQuote(command)}`;

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

    private async getClaimForAgent(agentId: string, claimName: string, namespace: string) {
        const claim = await agentSandboxAdapter.getSandboxClaim(claimName, namespace);
        if (!claim) {
            throw new ApiNotFoundException('Not Found', 'Agent sandbox not found.');
        }

        const claimAgentId = claim.metadata?.labels?.[Constants.QS_ANNOTATION_AGENT_ID];
        if (claimAgentId !== agentId) {
            throw new ServiceException('Agent sandbox does not belong to this Agent.');
        }

        return claim;
    }

    private async resolveTarget(agentId: string, claimName: string): Promise<ResolvedSandboxTarget> {
        const namespace = await this.getAgentNamespace(agentId);
        const claim = await this.getClaimForAgent(agentId, claimName, namespace);
        const sandboxName = claim.status?.sandbox?.name;
        if (!sandboxName) {
            throw new ServiceException('Agent sandbox is not ready.');
        }

        const sandbox = await agentSandboxAdapter.getSandbox(sandboxName, namespace);
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
            claimName,
            sandboxName,
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
            claimName: target.claimName,
            sandboxName: target.sandboxName,
            podName: target.podName,
            namespace: target.namespace,
            status: target.status,
            createdAt: target.createdAt,
            customTag: target.customTag ?? null,
        };
    }

    private async execInTarget(target: ResolvedSandboxTarget, command: string[]): Promise<CommandResultModel> {
        const stdoutStream = new stream.PassThrough();
        const stderrStream = new stream.PassThrough();
        let stdout = '';
        let stderr = '';

        stdoutStream.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        stderrStream.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        return new Promise<CommandResultModel>((resolve, reject) => {
            const exec = new k8s.Exec(k3s.getKubeConfig());
            exec.exec(
                target.namespace,
                target.podName,
                target.containerName,
                command,
                stdoutStream,
                stderrStream,
                null,
                false,
                (status: k8s.V1Status) => {
                    resolve({
                        stdout,
                        stderr,
                        exitCode: this.extractExitCode(status),
                    });
                },
            ).catch(reject);
        });
    }

    private async execShell(target: ResolvedSandboxTarget, command: string): Promise<CommandResultModel> {
        return this.execInTarget(target, ['sh', '-lc', command]);
    }

    private assertSuccessful(result: CommandResultModel, action: string): void {
        if (result.exitCode !== 0) {
            throw new ServiceException(`${action} failed: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`);
        }
    }

    private assertWritablePath(path: string): void {
        const isAbsolutePath = path.startsWith('/');

        if (!path || path.includes('\\') || path === '.' || path === '..' || path.includes('..') || (!isAbsolutePath && path.includes('/'))) {
            throw new ServiceException('Write path must be a plain filename or absolute path without traversal segments.');
        }
    }

    async createSandbox(agentId: string, userId: string, timeoutMs: number, input: CreateSandboxRequestModel = {}): Promise<AgentSandboxModel> {
        const { claimName } = await agentRuntimeService.startInstance(agentId, userId, {
            timeoutMs,
            ...input,
        });
        return this.getSandbox(agentId, claimName);
    }

    async listSandboxes(agentId: string): Promise<AgentSandboxModel[]> {
        const namespace = await this.getAgentNamespace(agentId);
        const claims = await agentRuntimeService.listInstances(agentId);
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
                    claimName: claim.name,
                    sandboxName: '',
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

    async getSandbox(agentId: string, claimName: string): Promise<AgentSandboxModel> {
        const target = await this.resolveTarget(agentId, claimName);
        return this.toSandboxModel(agentId, target);
    }

    async deleteSandbox(agentId: string, claimName: string): Promise<void> {
        await this.getSandbox(agentId, claimName);
        await agentRuntimeService.stopInstance(agentId, claimName);
    }

    async runCommand(agentId: string, claimName: string, input: CommandRequestModel): Promise<CommandResultModel> {
        const target = await this.resolveTarget(agentId, claimName);
        return this.execShell(target, this.buildShellScript(input.command, input));
    }

    async readFile(agentId: string, claimName: string, path: string): Promise<FileReadResultModel> {
        const target = await this.resolveTarget(agentId, claimName);
        const result = await this.execShell(target, `base64 < ${this.shellQuote(path)}`);
        this.assertSuccessful(result, 'Read file');
        return { dataBase64: result.stdout.replace(/\s/g, '') };
    }

    async readTextFile(agentId: string, claimName: string, path: string): Promise<FileTextReadResultModel> {
        const result = await this.readFile(agentId, claimName, path);
        return { text: Buffer.from(result.dataBase64, 'base64').toString() };
    }

    async writeFile(agentId: string, claimName: string, path: string, dataBase64: string): Promise<void> {
        this.assertWritablePath(path);
        const target = await this.resolveTarget(agentId, claimName);
        const result = await this.execShell(
            target,
            `printf %s ${this.shellQuote(dataBase64)} | base64 -d > ${this.shellQuote(path)}`,
        );
        this.assertSuccessful(result, 'Write file');
    }

    async writeTextFile(agentId: string, claimName: string, path: string, text: string): Promise<void> {
        this.assertWritablePath(path);
        const target = await this.resolveTarget(agentId, claimName);
        const dataBase64 = Buffer.from(text).toString('base64');
        const result = await this.execShell(
            target,
            `printf %s ${this.shellQuote(dataBase64)} | base64 -d > ${this.shellQuote(path)}`,
        );
        this.assertSuccessful(result, 'Write text file');
    }

    async listFiles(agentId: string, claimName: string, path: string): Promise<FileEntryModel[]> {
        const target = await this.resolveTarget(agentId, claimName);
        const quotedPath = this.shellQuote(path);
        const script = [
            `target=${quotedPath}`,
            'if [ ! -d "$target" ]; then echo "not a directory" >&2; exit 64; fi',
            'for p in "$target"/* "$target"/.[!.]* "$target"/..?*; do',
            '  [ -e "$p" ] || continue',
            '  type=other',
            '  [ -d "$p" ] && type=directory',
            '  [ -f "$p" ] && type=file',
            '  name=$(basename "$p" | base64 | tr -d "\\n")',
            '  full=$(printf "%s" "$p" | base64 | tr -d "\\n")',
            '  size=$(wc -c < "$p" 2>/dev/null || printf "0")',
            '  printf "%s\\t%s\\t%s\\t%s\\n" "$name" "$full" "$type" "$size"',
            'done',
        ].join('\n');
        const result = await this.execShell(target, script);
        this.assertSuccessful(result, 'List files');

        return result.stdout
            .split('\n')
            .filter(Boolean)
            .map((line) => {
                const [nameBase64, pathBase64, type, size] = line.split('\t');
                return {
                    name: Buffer.from(nameBase64, 'base64').toString(),
                    path: Buffer.from(pathBase64, 'base64').toString(),
                    type: type === 'directory' || type === 'file' ? type : 'other',
                    size: Number.parseInt(size, 10) || 0,
                };
            });
    }

    async fileExists(agentId: string, claimName: string, path: string): Promise<FileExistsResultModel> {
        const target = await this.resolveTarget(agentId, claimName);
        const result = await this.execShell(target, `test -e ${this.shellQuote(path)}`);
        return { exists: result.exitCode === 0 };
    }
}

const agentSandboxService = new AgentSandboxService();
export default agentSandboxService;
