import { AppBuildMethod } from "@/shared/model/app-source-info.model";

export class AppBuildMethodUtils {
    static normalize(buildMethod: string | null | undefined): AppBuildMethod {
        if (buildMethod === 'DOCKERFILE') {
            return 'DOCKERFILE';
        }
        if (buildMethod === 'FRAMEWORK') {
            return 'FRAMEWORK';
        }
        return 'RAILPACK';
    }
}
