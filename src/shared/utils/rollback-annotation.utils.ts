import { Constants } from "./constants";

export class RollbackAnnotationUtils {
    static isRollbackAnnotation(annotations?: { [key: string]: string }): boolean {
        return annotations?.[Constants.QS_ANNOTATION_ROLLBACK] === Constants.QS_ANNOTATION_VALUE_TRUE;
    }

    static rollbackAnnotation(isRollback?: boolean): Record<string, string> {
        return isRollback ? { [Constants.QS_ANNOTATION_ROLLBACK]: Constants.QS_ANNOTATION_VALUE_TRUE } : {};
    }
}
