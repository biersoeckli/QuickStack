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
        const tempDir = PathUtils.tempPathForApp(appId);
        try {
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
        } finally {
            // Ensure the temporary directory is cleaned up even if an error occurs
            await FsUtils.deleteDirIfExistsAsync(tempDir, true);
        }
    }

    /**
     * Creates a temporary SSH config and key files for Git operations
     * @param appId The ID of the app
     * @param privateKey The private SSH key
     * @returns The path to the SSH config file
     */
    async createTemporarySshConfig(appId: string, privateKey: string): Promise<{ sshConfigPath: string, cleanupFunction: () => Promise<void> }> {
        const tempDir = PathUtils.tempPathForApp(appId);
        try {

            await FsUtils.deleteDirIfExistsAsync(tempDir, true);
            await FsUtils.createDirIfNotExistsAsync(tempDir, true);

            const keyPath = path.join(tempDir, `id_rsa_${appId}`);
            const sshConfigPath = path.join(tempDir, 'ssh_config');

            // Write the private key to a temporary file
            fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });
            // set the file permissions to read/write for the owner only
            fs.chmodSync(keyPath, 0o600);

            // Create SSH config file with better host patterns
            const sshConfig = `
# SSH config for app ${appId}
Host github.com
    HostName github.com
    User git
    IdentityFile ${keyPath}
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null

Host gitlab.com
    HostName gitlab.com
    User git
    IdentityFile ${keyPath}
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null

Host bitbucket.org
    HostName bitbucket.org
    User git
    IdentityFile ${keyPath}
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null

Host *
    IdentityFile ${keyPath}
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR
`;
            fs.writeFileSync(sshConfigPath, sshConfig.trim());

            const cleanupFunction = async () => {
                try {
                    await FsUtils.deleteDirIfExistsAsync(tempDir, true);
                } catch (error) {
                    console.warn(`Failed to cleanup SSH temp directory: ${error}`);
                }
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
            console.log(`Converting HTTPS URL to SSH: ${httpsUrl}`);

            // Handle different URL formats
            let cleanUrl = httpsUrl.trim();

            // Remove any auth credentials from the URL
            cleanUrl = cleanUrl.replace(/https:\/\/[^@]*@/, 'https://');

            const url = new URL(cleanUrl);
            const hostname = url.hostname;
            let pathname = url.pathname;

            // Remove leading slash and ensure .git extension
            pathname = pathname.startsWith('/') ? pathname.substring(1) : pathname;
            if (!pathname.endsWith('.git')) {
                pathname += '.git';
            }

            const sshUrl = `git@${hostname}:${pathname}`;
            console.log(`Converted SSH URL: ${sshUrl}`);
            return sshUrl;
        } catch (error) {
            console.error('Error converting HTTPS URL to SSH:', error);
            throw new ServiceException(`Invalid Git URL format: ${httpsUrl}`);
        }
    }
}

const sshService = new SshService();
export default sshService;
