import { UserGroupUtils } from "@/shared/utils/role.utils";
import { adminRoleName, RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { UserSession } from "@/shared/model/sim-session.model";

describe(UserGroupUtils.name, () => {
    let adminSession: UserSession;
    let regularSession: UserSession;

    const projectId = "project-123";

    beforeEach(() => {
        adminSession = {
            userGroup: {
                name: adminRoleName,
            },
        } as any;

        // Regular user session without any project permissions by default
        regularSession = {
            userGroup: {
                name: "User",
                roleProjectPermissions: [],
            },
        } as any;
    });

    test("should return true if user is admin", () => {
        const result = UserGroupUtils.sessionHasReadAccessToProject(adminSession, projectId);
        expect(result).toBe(true);
    });

    test("should return false if non-admin user has no project permission", () => {
        const result = UserGroupUtils.sessionHasReadAccessToProject(regularSession, projectId);
        expect(result).toBe(false);
    });

    test("should return true if non-admin user has project permission with non-empty roleAppPermissions", () => {
        regularSession.userGroup!.roleProjectPermissions = [
            {
                projectId,
                roleAppPermissions: [{ appId: "app1", permission: RolePermissionEnum.READ }],
                readApps: false,
            },
        ] as any;
        const result = UserGroupUtils.sessionHasReadAccessToProject(regularSession, projectId);
        expect(result).toBe(true);
    });

    test("should return true if non-admin user has project permission with empty roleAppPermissions and readApps true", () => {
        regularSession.userGroup!.roleProjectPermissions = [
            {
                projectId,
                roleAppPermissions: [],
                readApps: true,
            },
        ] as any;
        const result = UserGroupUtils.sessionHasReadAccessToProject(regularSession, projectId);
        expect(result).toBe(true);
    });

    test("should return false if non-admin user has project permission with empty roleAppPermissions and readApps false", () => {
        regularSession.userGroup!.roleProjectPermissions = [
            {
                projectId,
                roleAppPermissions: [],
                readApps: false,
            },
        ] as any;
        const result = UserGroupUtils.sessionHasReadAccessToProject(regularSession, projectId);
        expect(result).toBe(false);
    });
});
