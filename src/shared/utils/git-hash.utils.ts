const GIT_COMMIT_TAG_LENGTH = 7;

export class GitHashUtils {
    static shortGitHash(hash?: string | null): string | undefined {
        if (!hash) {
            return undefined;
        }
        return hash.slice(0, GIT_COMMIT_TAG_LENGTH);
    }
}
