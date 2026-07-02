import { ServiceException } from "@/shared/model/service.exception.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppGitBranchesLookupModel } from "@/shared/model/app-source-info.model";
import simpleGit, { SimpleGit } from "simple-git";
import { PathUtils } from "../utils/path.utils";
import { FsUtils } from "../utils/fs.utils";
import path from "path";
import appGitSshKeyService from "./app-git-ssh-key.service";
import fs from "fs";
import agentGitSshKeyService from "./agent-git-ssh-key.service";

type GitWorkloadType = 'app' | 'agent';
type GitConnectionInfo = AppGitBranchesLookupModel & Pick<AppExtendedModel, 'id'> & { workloadType?: GitWorkloadType };
type GitDockerfileDetectionInfo = GitConnectionInfo & Pick<AppExtendedModel, 'gitBranch'>;
type GitContextInfo = {
    id: string;
    sourceType: string;
    gitUrl?: string | null;
    gitUsername?: string | null;
    gitToken?: string | null;
    gitBranch?: string | null;
    dockerfilePath?: string | null;
    workloadType?: GitWorkloadType;
};

class GitService {

    async openGitContext<T>(app: GitContextInfo, action: (ctx: InternalGitService) => Promise<T>): Promise<T> {
        try {
            let git: SimpleGit | undefined = undefined;
            let internalGitService: InternalGitService | undefined = undefined;
            try {
                git = await this.pullLatestChangesFromRepo(app);
                internalGitService = new InternalGitService(git, app);
            } catch (error) {
                console.error('Error while connecting to the git repository:', error);
                throw this.mapGitConnectionError(error, app.sourceType);
            }
            return await action(internalGitService);
        } catch (error) {
            throw error;
        } finally {
            await this.cleanupLocalGitDataForApp(app);
        }
    }

    async listRemoteBranches(input: GitConnectionInfo): Promise<string[]> {
        try {
            const git = simpleGit();
            const sshKeyPath = input.sourceType === 'GIT_SSH'
                ? await this.writePrivateKeyToTempFile(input)
                : undefined;
            if (sshKeyPath) {
                git.env('GIT_SSH_COMMAND', this.getGitSshCommand(sshKeyPath));
            }

            const remoteBranches = await git.listRemote(['--symref', this.getGitUrl(input), 'HEAD', 'refs/heads/*']);
            return this.parseRemoteBranches(remoteBranches);
        } catch (error) {
            console.error('Error while listing git branches:', error);
            throw this.mapGitConnectionError(error, input.sourceType);
        } finally {
            if (input.sourceType === 'GIT_SSH') {
                await this.cleanupTempKeyFile(input);
            }
        }
    }

    async detectDockerfilePath(input: GitDockerfileDetectionInfo): Promise<string> {
        return await this.openGitContext(input as AppExtendedModel, async (ctx) => ctx.detectDockerfilePath());
    }

    private async cleanupLocalGitDataForApp(app: GitContextInfo) {
        const gitPath = PathUtils.gitRootPathForApp(app.id);
        await FsUtils.deleteDirIfExistsAsync(gitPath, true);
        await this.cleanupTempKeyFile(app);
    }

    private async pullLatestChangesFromRepo(app: GitContextInfo) {
        console.log(`Pulling latest source for app ${app.id}...`);
        const gitPath = PathUtils.gitRootPathForApp(app.id);

        await FsUtils.deleteDirIfExistsAsync(gitPath, true);
        await FsUtils.createDirIfNotExistsAsync(gitPath, true);

        const git = simpleGit(gitPath);
        const sshKeyPath = app.sourceType === 'GIT_SSH'
            ? await this.writePrivateKeyToTempFile(app)
            : undefined;
        if (sshKeyPath) {
            git.env('GIT_SSH_COMMAND', this.getGitSshCommand(sshKeyPath));
        }
        const gitUrl = this.getGitUrl(app);

        // initial clone
        console.log(await git.clone(gitUrl, gitPath));
        console.log(await git.checkout(app.gitBranch ?? 'main'));
        console.log(`Source for app ${app.id} has been cloned successfully.`);

        return git;
    }

    private getGitUrl(app: Pick<AppExtendedModel, 'sourceType' | 'gitUrl' | 'gitUsername' | 'gitToken'>) {
        if (app.sourceType !== 'GIT_SSH' && app.gitUsername && app.gitToken) {
            return app.gitUrl!.replace('https://', `https://${app.gitUsername}:${app.gitToken}@`);
        }
        return app.gitUrl!;
    }

    private getGitSshCommand(sshConfigPath: string) {
        return `ssh -i ${sshConfigPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
    }

    private async writePrivateKeyToTempFile(input: { id: string; workloadType?: GitWorkloadType }) {
        if (input.workloadType === 'agent') {
            return agentGitSshKeyService.writePrivateKeyToTempFile(input.id);
        }
        return appGitSshKeyService.writePrivateKeyToTempFile(input.id);
    }

    private async cleanupTempKeyFile(input: { id: string; workloadType?: GitWorkloadType }) {
        if (input.workloadType === 'agent') {
            await agentGitSshKeyService.cleanupTempKeyFile(input.id);
            return;
        }
        await appGitSshKeyService.cleanupTempKeyFile(input.id);
    }

    private mapGitConnectionError(error: unknown, sourceType: string) {
        if (error instanceof Error) {
            if (error.message.includes('Permission denied')) {
                if (sourceType === 'GIT_SSH') {
                    return new ServiceException("Git: SSH permission denied. Please check your SSH key configuration and ensure the public key is added to your Git provider.");
                }
                return new ServiceException("Git: Permission denied. Please check your Git credentials or SSH key.");
            } else if (error.message.includes('Host key verification failed')) {
                return new ServiceException("Git: SSH host key verification failed.");
            } else if (error.message.includes('Repository not found')) {
                return new ServiceException("Git repository not found. Please check the repository URL.");
            } else if (error.message.includes('Authentication failed')) {
                return new ServiceException("Git authentication failed. Please check your credentials.");
            }
        }

        return new ServiceException(`Error while connecting to the git repository: ${error}`);
    }

    private parseRemoteBranches(remoteBranches: string) {
        let defaultBranch: string | undefined;
        const branches = new Set<string>();

        remoteBranches.split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .forEach((line) => {
                const [left, right] = line.split(/\s+/);
                if (left === 'ref:' && right?.startsWith('refs/heads/') && line.endsWith('HEAD')) {
                    defaultBranch = this.stripHeadRef(right);
                    return;
                }
                if (right?.startsWith('refs/heads/')) {
                    branches.add(this.stripHeadRef(right));
                }
            });

        return this.sortBranches(Array.from(branches), defaultBranch);
    }

    private stripHeadRef(ref: string) {
        return ref.replace(/^refs\/heads\//, '');
    }

    private sortBranches(branches: string[], defaultBranch?: string) {
        const priorityBranches = [defaultBranch, 'main', 'master'].filter((branch): branch is string => !!branch);
        const prioritized = priorityBranches.filter((branch, index) =>
            branches.includes(branch) && priorityBranches.indexOf(branch) === index
        );
        const prioritySet = new Set(prioritized);
        const rest = branches
            .filter(branch => !prioritySet.has(branch))
            .sort((a, b) => a.localeCompare(b));

        return [...prioritized, ...rest];
    }
}

class InternalGitService {

    constructor(private readonly git: SimpleGit,
        private readonly app: GitContextInfo
    ) { }

    async checkIfDockerfileExists() {
        const gitPath = PathUtils.gitRootPathForApp(this.app.id);
        const dockerFilePath = this.app.dockerfilePath;
        if (!dockerFilePath) {
            throw new ServiceException("Dockerfile path is not set.");
        }
        const absolutePath = path.join(gitPath, dockerFilePath);
        console.log(`Checking if Dockerfile exists at ${absolutePath}`);
        if (!await FsUtils.fileExists(absolutePath)) {
            throw new ServiceException(`Dockerfile does not exists at ${dockerFilePath}`);
        }
    }

    async detectDockerfilePath() {
        const gitPath = PathUtils.gitRootPathForApp(this.app.id);
        if (await FsUtils.fileExists(path.join(gitPath, 'Dockerfile'))) {
            return './Dockerfile';
        }
        const dockerfiles = await this.findDockerfiles(gitPath);
        const [preferredDockerfile] = dockerfiles.sort((a, b) => {
            if (a.length !== b.length) {
                return a.length - b.length;
            }
            return a.localeCompare(b);
        });
        return preferredDockerfile ? `./${preferredDockerfile}` : './Dockerfile';
    }

    private async findDockerfiles(rootPath: string, relativePath = ''): Promise<string[]> {
        const ignoredDirectories = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
        const currentPath = path.join(rootPath, relativePath);
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        const dockerfiles: string[] = [];

        for (const entry of entries) {
            const entryRelativePath = path.join(relativePath, entry.name);
            if (entry.isDirectory()) {
                if (!ignoredDirectories.has(entry.name)) {
                    dockerfiles.push(...await this.findDockerfiles(rootPath, entryRelativePath));
                }
                continue;
            }
            if (entry.isFile() && entry.name === 'Dockerfile') {
                dockerfiles.push(entryRelativePath);
            }
        }

        return dockerfiles;
    }

    async checkIfLocalRepoIsUpToDate() {

        const gitPath = PathUtils.gitRootPathForApp(this.app.id);
        if (!FsUtils.directoryExists(gitPath)) {
            return false;
        }

        if (await FsUtils.isFolderEmpty(gitPath)) {
            return false;
        }

        await this.git.fetch();

        const status = await this.git.status();
        if (status.behind > 0) {
            console.log(`The local repository is behind by ${status.behind} commits and needs to be updated.`);
            return false;
        } else if (status.ahead > 0) {
            throw new Error(`The local repository is ahead by ${status.ahead} commits. This should not happen.`);
        }

        // The local repository is up to date
        return true
    }

    async getLatestRemoteCommitHash() {
        const log = await this.git.log();
        if (log.latest) {
            return log.latest.hash;
        } else {
            throw new ServiceException("The git repository is empty.");
        }
    }

    async getLatestRemoteCommitMessage() {
        const log = await this.git.log();
        return log.latest?.message ?? '';
    }
}

const gitService = new GitService();
export default gitService;
