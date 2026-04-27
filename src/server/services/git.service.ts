import { ServiceException } from "@/shared/model/service.exception.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import simpleGit, { SimpleGit } from "simple-git";
import { PathUtils } from "../utils/path.utils";
import { FsUtils } from "../utils/fs.utils";
import path from "path";
import appGitSshKeyService from "./app-git-ssh-key.service";


class GitService {

    async openGitContext<T>(app: AppExtendedModel, action: (ctx: InternalGitService) => Promise<T>): Promise<T> {
        try {
            let git: SimpleGit | undefined = undefined;
            let internalGitService: InternalGitService | undefined = undefined;
            try {
                git = await this.pullLatestChangesFromRepo(app);
                internalGitService = new InternalGitService(git, app);
            } catch (error) {
                console.error('Error while connecting to the git repository:', error);
                // Provide more specific error messages
                if (error instanceof Error) {
                    if (error.message.includes('Permission denied')) {
                        if (app.sourceType === 'GIT_SSH') {
                            throw new ServiceException("Git: SSH permission denied. Please check your SSH key configuration and ensure the public key is added to your Git provider.");
                        }
                        throw new ServiceException("Git: Permission denied. Please check your Git credentials or SSH key.");
                    } else if (error.message.includes('Host key verification failed')) {
                        throw new ServiceException("Git: SSH host key verification failed.");
                    } else if (error.message.includes('Repository not found')) {
                        throw new ServiceException("Git repository not found. Please check the repository URL.");
                    } else if (error.message.includes('Authentication failed')) {
                        throw new ServiceException("Git authentication failed. Please check your credentials.");
                    }
                }

                throw new ServiceException(`Error while connecting to the git repository: ${error}`);
            }
            return await action(internalGitService);
        } catch (error) {
            throw error;
        } finally {
            await this.cleanupLocalGitDataForApp(app);
        }
    }

    private async cleanupLocalGitDataForApp(app: AppExtendedModel) {
        const gitPath = PathUtils.gitRootPathForApp(app.id);
        await FsUtils.deleteDirIfExistsAsync(gitPath, true);
        await appGitSshKeyService.cleanupTempKeyFile(app.id);
    }

    private async pullLatestChangesFromRepo(app: AppExtendedModel) {
        console.log(`Pulling latest source for app ${app.id}...`);
        const gitPath = PathUtils.gitRootPathForApp(app.id);

        await FsUtils.deleteDirIfExistsAsync(gitPath, true);
        await FsUtils.createDirIfNotExistsAsync(gitPath, true);

        const git = simpleGit(gitPath);
        const sshKeyPath = app.sourceType === 'GIT_SSH'
            ? await appGitSshKeyService.writePrivateKeyToTempFile(app.id)
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

    private getGitUrl(app: AppExtendedModel) {
        if (app.sourceType !== 'GIT_SSH' && app.gitUsername && app.gitToken) {
            return app.gitUrl!.replace('https://', `https://${app.gitUsername}:${app.gitToken}@`);
        }
        return app.gitUrl!;
    }

    private getGitSshCommand(sshConfigPath: string) {
        return `ssh -i ${sshConfigPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
    }
}

class InternalGitService {

    constructor(private readonly git: SimpleGit,
        private readonly app: AppExtendedModel
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
