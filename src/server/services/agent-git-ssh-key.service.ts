import { revalidateTag } from "next/cache";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import dataAccess from "../adapter/db.client";
import { CryptoUtils } from "../utils/crypto.utils";
import { FsUtils } from "../utils/fs.utils";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { Tags } from "../utils/cache-tag-generator.utils";
import { PathUtils } from "../utils/path.utils";

const execFileAsync = promisify(execFile);

class AgentGitSshKeyService {

    async getPublicKey(agentId: string): Promise<string | undefined> {
        const key = await dataAccess.client.agentGitSshKey.findUnique({
            where: { agentId },
            select: { publicKey: true },
        });
        return key?.publicKey;
    }

    async ensurePublicKey(agentId: string): Promise<string> {
        const publicKey = await this.getPublicKey(agentId);
        if (publicKey) {
            return publicKey;
        }
        return await this.generateOrRegenerate(agentId);
    }

    async generateOrRegenerate(agentId: string): Promise<string> {
        const { publicKey, privateKey } = await this.generateEd25519KeyPair(agentId);
        const encryptedPrivateKey = CryptoUtils.encrypt(privateKey);

        const key = await dataAccess.client.agentGitSshKey.upsert({
            where: { agentId },
            create: {
                agentId,
                publicKey,
                encryptedPrivateKey,
            },
            update: {
                publicKey,
                encryptedPrivateKey,
            },
        });

        revalidateTag(Tags.agent(agentId));
        return key.publicKey;
    }

    async getDecryptedPrivateKey(agentId: string): Promise<string | undefined> {
        const key = await dataAccess.client.agentGitSshKey.findUnique({
            where: { agentId },
            select: { encryptedPrivateKey: true },
        });
        if (!key) {
            return undefined;
        }
        return CryptoUtils.decrypt(key.encryptedPrivateKey);
    }

    async writePrivateKeyToTempFile(agentId: string): Promise<string | undefined> {
        const privateKey = await this.getDecryptedPrivateKey(agentId);
        if (!privateKey) {
            return undefined;
        }
        await this.ensureTempGitSshPathExists();
        const keyRoot = path.join(PathUtils.tempGitSshPath, KubeObjectNameUtils.toSnakeCase(agentId));
        await FsUtils.deleteDirIfExistsAsync(keyRoot, true);
        await FsUtils.createDirIfNotExistsAsync(keyRoot, true);
        const keyPath = path.join(keyRoot, "id_ed25519");
        await fs.promises.writeFile(keyPath, privateKey, { mode: 0o600 });
        await fs.promises.chmod(keyPath, 0o600);
        return keyPath;
    }

    async cleanupTempKeyFile(agentId: string) {
        const keyRoot = path.join(PathUtils.tempGitSshPath, KubeObjectNameUtils.toSnakeCase(agentId));
        await FsUtils.deleteDirIfExistsAsync(keyRoot, true);
    }

    private async generateEd25519KeyPair(agentId: string): Promise<{ publicKey: string; privateKey: string }> {
        await this.ensureTempGitSshPathExists();
        const tempRoot = await fs.promises.mkdtemp(path.join(PathUtils.tempGitSshPath, "agent-keygen-"));
        const keyPath = path.join(tempRoot, "id_ed25519");
        try {
            await execFileAsync("ssh-keygen", [
                "-t",
                "ed25519",
                "-N",
                "",
                "-C",
                `quickstack-${agentId}-${crypto.randomBytes(8).toString("hex")}`,
                "-f",
                keyPath,
            ]);

            const [privateKey, publicKey] = await Promise.all([
                fs.promises.readFile(keyPath, "utf-8"),
                fs.promises.readFile(`${keyPath}.pub`, "utf-8"),
            ]);
            return {
                privateKey,
                publicKey: publicKey.trim(),
            };
        } finally {
            await FsUtils.deleteDirIfExistsAsync(tempRoot, true);
        }
    }

    private async ensureTempGitSshPathExists() {
        await FsUtils.createDirIfNotExistsAsync(PathUtils.tempGitSshPath, true);
    }
}

const agentGitSshKeyService = new AgentGitSshKeyService();
export default agentGitSshKeyService;
