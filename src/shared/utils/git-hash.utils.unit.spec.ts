import { GitHashUtils } from "./git-hash.utils";

describe('GitHashUtils.shortGitHash', () => {
    it('returns undefined for undefined and null', () => {
        expect(GitHashUtils.shortGitHash(undefined)).toBeUndefined();
        expect(GitHashUtils.shortGitHash(null)).toBeUndefined();
        expect(GitHashUtils.shortGitHash('')).toBeUndefined();
    });

    it('returns the first 7 characters of a full hash', () => {
        expect(GitHashUtils.shortGitHash('abcdef1234567890')).toBe('abcdef1');
    });

    it('returns the whole hash when it is shorter than 7 characters', () => {
        expect(GitHashUtils.shortGitHash('abc123')).toBe('abc123');
    });
});
