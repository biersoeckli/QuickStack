import { K3sVersionUtils } from '@/server/utils/k3s-version.utils';

describe('K3sVersionUtils', () => {
    describe('getMinorVersion', () => {
        it('should extract minor version from full K3s version', () => {
            expect(K3sVersionUtils.getMinorVersion('v1.31.3+k3s1')).toBe('v1.31');
            expect(K3sVersionUtils.getMinorVersion('v1.30.5+k3s2')).toBe('v1.30');
            expect(K3sVersionUtils.getMinorVersion('v1.32.0+k3s1')).toBe('v1.32');
        });

        it('should handle versions without K3s suffix', () => {
            expect(K3sVersionUtils.getMinorVersion('v1.31.3')).toBe('v1.31');
            expect(K3sVersionUtils.getMinorVersion('v1.30.5')).toBe('v1.30');
        });

        it('should handle versions without v prefix', () => {
            expect(K3sVersionUtils.getMinorVersion('1.31.3+k3s1')).toBe('v1.31');
            expect(K3sVersionUtils.getMinorVersion('1.30.5')).toBe('v1.30');
        });

        it('should handle versions with only major.minor', () => {
            expect(K3sVersionUtils.getMinorVersion('v1.31')).toBe('v1.31');
            expect(K3sVersionUtils.getMinorVersion('1.30')).toBe('v1.30');
        });

        it('should throw error for invalid version formats', () => {
            expect(() => K3sVersionUtils.getMinorVersion('')).toThrow('Version string is required');
            expect(() => K3sVersionUtils.getMinorVersion('v1')).toThrow('Invalid version format');
            expect(() => K3sVersionUtils.getMinorVersion('invalid')).toThrow('Invalid version format');
            expect(() => K3sVersionUtils.getMinorVersion('v1.x.3')).toThrow('Invalid version format');
        });

        it('should handle edge cases with multiple dots', () => {
            expect(K3sVersionUtils.getMinorVersion('v1.31.3.4+k3s1')).toBe('v1.31');
        });
    });
});
