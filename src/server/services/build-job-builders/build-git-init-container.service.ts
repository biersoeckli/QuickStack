import { V1Container } from "@kubernetes/client-node";
import { BuildJobBuilderContext } from "./build-job-builder.interface";
import { BUILD_SOURCE_PATH, BUILD_WORKSPACE_MOUNT_PATH, BUILD_WORKSPACE_VOLUME_NAME } from "./build-workspace.constants";

export const BUILD_GIT_INIT_CONTAINER_NAME = 'build-git-init';
export const BUILD_GIT_SSH_KEY_VOLUME_NAME = 'build-git-ssh-key';
export const BUILD_GIT_SSH_KEY_MOUNT_PATH = '/git-ssh-key';
const GIT_SSH_PRIVATE_KEY_SECRET_KEY = 'ssh-privatekey';
export const BUILD_GIT_SSH_KEY_PATH = `${BUILD_GIT_SSH_KEY_MOUNT_PATH}/${GIT_SSH_PRIVATE_KEY_SECRET_KEY}`;

class BuildGitInitContainerService {

    getInitContainer(ctx: BuildJobBuilderContext): V1Container {
        const script = [
            'set -eu',
            'rm -rf "$SOURCE_PATH"',
            'mkdir -p "$WORKSPACE_PATH"',
            'git clone --depth 1 --single-branch --branch "$GIT_BRANCH" "$GIT_URL" "$SOURCE_PATH"',
            'cd "$SOURCE_PATH"',
            'if ! git cat-file -e "$GIT_COMMIT^{commit}" 2>/dev/null; then',
            '  echo "Commit $GIT_COMMIT not found in shallow clone. Fetching commit directly."',
            '  git fetch --depth 1 origin "$GIT_COMMIT"',
            'fi',
            'git checkout --detach "$GIT_COMMIT"',
            'echo "Successfully checked out git commit: $(git rev-parse HEAD)"',
        ].filter(Boolean).join('\n');

        return {
            name: BUILD_GIT_INIT_CONTAINER_NAME,
            image: 'alpine/git',
            command: ['sh', '-c'],
            args: [script],
            env: [
                {
                    name: 'GIT_URL',
                    value: this.getAuthenticatedGitUrl(ctx),
                },
                {
                    name: 'GIT_BRANCH',
                    value: ctx.app.gitBranch ?? 'main',
                },
                {
                    name: 'GIT_COMMIT',
                    value: ctx.latestRemoteGitHash,
                },
                {
                    name: 'WORKSPACE_PATH',
                    value: BUILD_WORKSPACE_MOUNT_PATH,
                },
                {
                    name: 'SOURCE_PATH',
                    value: BUILD_SOURCE_PATH,
                },
                ...(ctx.gitSshPrivateKeySecretName ? [{
                    name: 'GIT_SSH_COMMAND',
                    value: `ssh -i ${BUILD_GIT_SSH_KEY_PATH} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`,
                }] : []),
            ],
            volumeMounts: [
                { name: BUILD_WORKSPACE_VOLUME_NAME, mountPath: BUILD_WORKSPACE_MOUNT_PATH },
                ...(ctx.gitSshPrivateKeySecretName ? [{
                    name: BUILD_GIT_SSH_KEY_VOLUME_NAME,
                    mountPath: BUILD_GIT_SSH_KEY_MOUNT_PATH,
                    readOnly: true,
                }] : []),
            ],
        };
    }

    private getAuthenticatedGitUrl(ctx: BuildJobBuilderContext) {
        if (ctx.app.sourceType !== 'GIT_SSH' && ctx.app.gitUsername && ctx.app.gitToken) {
            return ctx.app.gitUrl!.replace('https://', `https://${ctx.app.gitUsername}:${ctx.app.gitToken}@`);
        }
        return ctx.app.gitUrl!;
    }
}

const buildGitInitContainerService = new BuildGitInitContainerService();
export default buildGitInitContainerService;
