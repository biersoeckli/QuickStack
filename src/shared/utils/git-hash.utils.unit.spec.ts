import { shortGitHash } from "./git-hash.utils";

describe('shortGitHash', () => {
    it('returns undefined for undefined and null', () => {
        expect(shortGitHash(undefined)).toBeUndefined();
        expect(shortGitHash(null)).toBeUndefined();
        expect(shortGitHash('')).toBeUndefined();
    });

    it('returns the first 12 characters of a full hash', () => {
        expect(shortGitHash('abcdef1234567890')).toBe('abcdef123456');
    });

    it('returns the whole hash when it is shorter than 12 characters', () => {
        expect(shortGitHash('abc123')).toBe('abc123');
    });
});
