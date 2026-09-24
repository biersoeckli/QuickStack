import { AppLifecycleUtils } from './app-lifecycle.utils';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';

const app = {
    appType: 'APP',
    sourceType: 'GIT',
    gitUrl: 'https://github.com/quickstack/app.git',
    gitBranch: 'main',
} as AppExtendedModel;

describe('AppLifecycleUtils.availability', () => {
    test.each([
        ['DEPLOYED', true, true, false],
        ['SHUTDOWN', true, false, true],
        ['BUILDING', true, true, false],
        ['UNKNOWN', true, true, true],
    ])('maps %s to the permitted App lifecycle actions', (status, canDeploy, canStop, canStart) => {
        expect(AppLifecycleUtils.availability(app, RolePermissionEnum.READWRITE, status)).toMatchObject({
            canDeploy,
            supportsRebuild: true,
            canRebuild: true,
            canStart,
            canStop,
        });
    });

    test('denies every App lifecycle action without a configured Source or write permission', () => {
        expect(AppLifecycleUtils.availability({ ...app, gitBranch: '' }, RolePermissionEnum.READWRITE, 'UNKNOWN')).toMatchObject({
            canDeploy: false,
            supportsRebuild: true,
            canRebuild: false,
            canStart: false,
            canStop: false,
        });
        expect(AppLifecycleUtils.availability(app, undefined, 'UNKNOWN')).toMatchObject({
            canManage: false,
            canDeploy: false,
            canStart: false,
            canStop: false,
        });
    });
});
