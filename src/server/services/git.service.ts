import { ServiceException } from "@/shared/model/service.exception.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import simpleGit, { SimpleGit } from "simple-git";
import { PathUtils } from "../utils/path.utils";
import { FsUtils } from "../utils/fs.utils";
import path from "path";
import sshService from "./ssh.service";


class GitService {

    async openGitContext<T>(app: AppExtendedModel, action: (ctx: InternalGitService) => Promise<T>): Promise<T> {
        let sshCleanup: (() => Promise<void>) | undefined = undefined;
        try {
            let git: SimpleGit | undefined = undefined;
            let internalGitService: InternalGitService | undefined = undefined;
            try {
                const result = await this.pullLatestChangesFromRepo(app);
                git = result.git;
                sshCleanup = result.sshCleanup;
                internalGitService = new InternalGitService(git, app);
            } catch (error) {
                console.error('Error while connecting to the git repository:', error);
                throw new ServiceException("Error while connecting to the git repository.");
            }
            return await action(internalGitService);
        } catch (error) {
            throw error;
        } finally {
            await this.cleanupLocalGitDataForApp(app);
            if (sshCleanup) {
                await sshCleanup();
            }
        }
    }

    private async cleanupLocalGitDataForApp(app: AppExtendedModel) {
        const gitPath = PathUtils.gitRootPathForApp(app.id);
        await FsUtils.deleteDirIfExistsAsync(gitPath, true);
    }

    private async pullLatestChangesFromRepo(app: AppExtendedModel): Promise<{ git: SimpleGit, sshCleanup?: () => Promise<void> }> {
        console.log(`Pulling latest source for app ${app.id}...`);
        const gitPath = PathUtils.gitRootPathForApp(app.id);

        await FsUtils.deleteDirIfExistsAsync(gitPath, true);
        await FsUtils.createDirIfNotExistsAsync(gitPath, true);

        let sshCleanup: (() => Promise<void>) | undefined = undefined;
        let git: SimpleGit;

        if (app.gitAuthType === 'SSH' && app.gitSshPrivateKey) {
            // Setup SSH authentication
            const { sshConfigPath, cleanupFunction } = await sshService.createTemporarySshConfig(app.id, app.gitSshPrivateKey);
            sshCleanup = cleanupFunction;

            // Create git instance with SSH config
            git = simpleGit(gitPath, {
                config: [`core.sshCommand=ssh -F ${sshConfigPath}`]
            });

            // Use SSH URL
            const sshUrl = sshService.convertHttpsToSshUrl(app.gitUrl!);
            console.log(await git.clone(sshUrl, gitPath));
        } else {
            // Use HTTPS authentication (existing logic)
            git = simpleGit(gitPath);
            const gitUrl = this.getGitUrl(app);
            console.log(await git.clone(gitUrl, gitPath));
        }

        console.log(await git.checkout(app.gitBranch ?? 'main'));
        console.log(`Source for app ${app.id} has been cloned successfully.`);

        return { git, sshCleanup };
    }

    private getGitUrl(app: AppExtendedModel) {
        if (app.gitUsername && app.gitToken) {
            return app.gitUrl!.replace('https://', `https://${app.gitUsername}:${app.gitToken}@`);
        }
        return app.gitUrl!;
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
}

const gitService = new GitService();
export default gitService;
