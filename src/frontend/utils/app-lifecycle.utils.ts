import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import { AppSourceUtils } from './app-source.utils';

export class AppLifecycleUtils {
    static availability(
        app: AppExtendedModel,
        role: RolePermissionEnum | undefined,
        deploymentStatus: string,
    ) {
        const canManage = role === RolePermissionEnum.READWRITE;
        const sourceConfigured = AppSourceUtils.isConfiguredSource(app);
        const canDeploy = canManage && sourceConfigured;

        return {
            canManage,
            canDeploy,
            supportsRebuild:
                app.appType === 'APP'
                && (app.sourceType === 'GIT' || app.sourceType === 'GIT_SSH'),
            canRebuild:
                canDeploy
                && app.appType === 'APP'
                && (app.sourceType === 'GIT' || app.sourceType === 'GIT_SSH'),
            canStart:
                canDeploy
                && ['ERROR', 'UNKNOWN', 'SHUTDOWN', 'SHUTTING_DOWN'].includes(
                    deploymentStatus,
                ),
            canStop:
                canDeploy
                && ['BUILDING', 'DEPLOYED', 'ERROR', 'UNKNOWN', 'DEPLOYING'].includes(
                    deploymentStatus,
                ),
        };
    }
}
