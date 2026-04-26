import { PathUtils } from "@/server/utils/path.utils";
import path from "path";

export function mockPathUtilsForTests() {
    const testStorageRoot = path.join(process.cwd(), 'storage');
    const originalInternalDataRoot = Object.getOwnPropertyDescriptor(PathUtils, 'internalDataRoot');
    const originalTempDataRoot = Object.getOwnPropertyDescriptor(PathUtils, 'tempDataRoot');

    Object.defineProperty(PathUtils, 'internalDataRoot', {
        configurable: true,
        get: () => path.join(testStorageRoot, 'internal'),
    });

    Object.defineProperty(PathUtils, 'tempDataRoot', {
        configurable: true,
        get: () => path.join(testStorageRoot, 'tmp'),
    });
    return { originalInternalDataRoot, originalTempDataRoot };
}