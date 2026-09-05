const GIT_COMMIT_TAG_LENGTH = 12;

export function shortGitHash(hash?: string | null): string | undefined {
    if (!hash) {
        return undefined;
    }
    return hash.slice(0, GIT_COMMIT_TAG_LENGTH);
}
