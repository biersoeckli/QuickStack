import { AppBuildMethodUtils } from "./app-build-method.utils";

describe('AppBuildMethodUtils', () => {
    it('normalizes known build methods and falls back to Railpack', () => {
        expect(AppBuildMethodUtils.normalize('DOCKERFILE')).toBe('DOCKERFILE');
        expect(AppBuildMethodUtils.normalize('FRAMEWORK')).toBe('FRAMEWORK');
        expect(AppBuildMethodUtils.normalize('RAILPACK')).toBe('RAILPACK');
        expect(AppBuildMethodUtils.normalize(undefined)).toBe('RAILPACK');
        expect(AppBuildMethodUtils.normalize('SOMETHING_ELSE')).toBe('RAILPACK');
    });
});
