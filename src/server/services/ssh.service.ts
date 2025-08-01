import { ServiceException } from "@/shared/model/service.exception.model";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PathUtils } from "../utils/path.utils";
import { FsUtils } from "../utils/fs.utils";

export interface SshKeyPair {
    privateKey: string;
    publicKey: string;
}

class SshService {

    /**
     * Generates a new SSH key pair for an app
     * @param appId The ID of the app
     * @returns The SSH key pair (private and public key)
     */
    async generateSshKeyPair(appId: string): Promise<SshKeyPair> {
        try {
            const tempDir = PathUtils.tempPathForApp(appId);
            await FsUtils.deleteDirIfExistsAsync(tempDir, true);
            await FsUtils.createDirIfNotExistsAsync(tempDir, true);

            const keyPath = path.join(tempDir, `id_rsa_${appId}`);
            const publicKeyPath = `${keyPath}.pub`;

            // Generate SSH key pair using ssh-keygen
            // -t rsa: Use RSA algorithm
            // -b 4096: 4096 bit key size
            // -f keyPath: Output file path
            // -N "": Empty passphrase
            // -C comment: Comment for the key
            const command = `ssh-keygen -t rsa -b 4096 -f "${keyPath}" -N "" -C "quickstack-app-${appId}"`;

            execSync(command, { stdio: 'pipe' });

            // Read the generated keys
            const privateKey = fs.readFileSync(keyPath, 'utf8');
            const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

            // Clean up temporary files
            await FsUtils.deleteDirIfExistsAsync(tempDir, true);

            return {
                privateKey: privateKey.trim(),
                publicKey: publicKey.trim()
            };
        } catch (error) {
            console.error('Error generating SSH key pair:', error);
            throw new ServiceException('Failed to generate SSH key pair');
        }
    }

    /**
     * Creates a temporary SSH config and key files for Git operations
     * @param appId The ID of the app
     * @param privateKey The private SSH key
     * @returns The path to the SSH config file
     */
    async createTemporarySshConfig(appId: string, privateKey: string): Promise<{ sshConfigPath: string, cleanupFunction: () => Promise<void> }> {
        try {
            const tempDir = PathUtils.tempPathForApp(appId);
            await FsUtils.createDirIfNotExistsAsync(tempDir, true);

            const keyPath = path.join(tempDir, `id_rsa_${appId}`);
            const sshConfigPath = path.join(tempDir, 'ssh_config');

            // Write the private key to a temporary file
            fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });

            // Create SSH config file
            const sshConfig = `
Host *
    IdentityFile ${keyPath}
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    IdentitiesOnly yes
`;
            fs.writeFileSync(sshConfigPath, sshConfig);

            const cleanupFunction = async () => {
                await FsUtils.deleteDirIfExistsAsync(tempDir, true);
            };

            return { sshConfigPath, cleanupFunction };
        } catch (error) {
            console.error('Error creating temporary SSH config:', error);
            throw new ServiceException('Failed to create temporary SSH config');
        }
    }

    /**
     * Converts HTTPS Git URL to SSH format
     * @param httpsUrl The HTTPS Git URL
     * @returns The SSH Git URL
     */
    convertHttpsToSshUrl(httpsUrl: string): string {
        try {
            // Convert https://github.com/user/repo.git to git@github.com:user/repo.git
            // Convert https://gitlab.com/user/repo.git to git@gitlab.com:user/repo.git
            const url = new URL(httpsUrl);
            const hostname = url.hostname;
            const pathname = url.pathname;

            // Remove leading slash and ensure .git extension
            let repoPath = pathname.startsWith('/') ? pathname.substring(1) : pathname;
            if (!repoPath.endsWith('.git')) {
                repoPath += '.git';
            }

            return `git@${hostname}:${repoPath}`;
        } catch (error) {
            console.error('Error converting HTTPS URL to SSH:', error);
            throw new ServiceException('Invalid Git URL format');
        }
    }
}

const sshService = new SshService();
export default sshService;
