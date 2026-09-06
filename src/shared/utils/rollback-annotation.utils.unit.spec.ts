import { RollbackAnnotationUtils } from "./rollback-annotation.utils";

describe('RollbackAnnotationUtils', () => {
    it('rollbackAnnotation returns an empty map when not rolling back', () => {
        expect(RollbackAnnotationUtils.rollbackAnnotation()).toEqual({});
        expect(RollbackAnnotationUtils.rollbackAnnotation(false)).toEqual({});
    });

    it('rollbackAnnotation returns the rollback entry when rolling back', () => {
        expect(RollbackAnnotationUtils.rollbackAnnotation(true)).toEqual({ 'qs-is-rollback': 'true' });
    });

    it('isRollbackAnnotation reads the rollback value from an annotation map', () => {
        expect(RollbackAnnotationUtils.isRollbackAnnotation(undefined)).toBe(false);
        expect(RollbackAnnotationUtils.isRollbackAnnotation({})).toBe(false);
        expect(RollbackAnnotationUtils.isRollbackAnnotation({ 'qs-is-rollback': 'true' })).toBe(true);
        expect(RollbackAnnotationUtils.isRollbackAnnotation({ 'qs-is-rollback': 'false' })).toBe(false);
        expect(RollbackAnnotationUtils.isRollbackAnnotation({ 'some-other': 'true' })).toBe(false);
    });
});
