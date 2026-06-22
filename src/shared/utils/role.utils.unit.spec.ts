import { adminRoleName, RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { UserSession } from "@/shared/model/sim-session.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";

describe(UserGroupUtils.name, () => {
    let adminSession: UserSession;
    let regularSession: UserSession;

    const projectId = "project-123";
    const workloadId = "app-123";
    const otherWorkloadId = "app-999";

    beforeEach(() => {
        adminSession = {
            userGroup: {
                name: adminRoleName,
                id: "admin-group",
                canAccessBackups: true,
                roleProjectPermissions: [],
            },
        } as any;

        regularSession = {
            userGroup: {
                name: "User",
                id: "user-group",
                canAccessBackups: false,
                roleProjectPermissions: [],
            },
        } as any;
    });

    function setProjectPermission(overrides: Record<string, unknown> = {}) {
        regularSession.userGroup!.roleProjectPermissions = [{
            projectId,
            project: {
                projectWorkloads: [
                    { id: workloadId, name: "App One" },
                    { id: otherWorkloadId, name: "App Two" },
                ],
            },
            createWorkloads: false,
            deleteWorkloads: false,
            writeWorkloads: false,
            readWorkloads: false,
            workloadPermissions: [],
            ...overrides,
        }] as any;
    }

    test("admin gets project and workload access", () => {
        expect(UserGroupUtils.sessionHasReadAccessToProject(adminSession, projectId)).toBe(true);
        expect(UserGroupUtils.getRolePermissionForProjectWorkload(adminSession, workloadId)).toBe(RolePermissionEnum.READWRITE);
        expect(UserGroupUtils.sessionHasWriteAccessForProjectWorkload(adminSession, workloadId)).toBe(true);
    });

    test("object-level workload read grant gives project visibility", () => {
        setProjectPermission({
            workloadPermissions: [{ workloadId, permission: RolePermissionEnum.READ }],
        });

        expect(UserGroupUtils.sessionHasReadAccessToProject(regularSession, projectId)).toBe(true);
        expect(UserGroupUtils.getRolePermissionForProjectWorkload(regularSession, workloadId)).toBe(RolePermissionEnum.READ);
        expect(UserGroupUtils.sessionHasReadAccessForProjectWorkload(regularSession, workloadId)).toBe(true);
        expect(UserGroupUtils.sessionHasWriteAccessForProjectWorkload(regularSession, workloadId)).toBe(false);
    });

    test("project-level fallback grants readwrite when no workload overrides exist", () => {
        setProjectPermission({
            readWorkloads: true,
            writeWorkloads: true,
        });

        expect(UserGroupUtils.getRolePermissionForProjectWorkload(regularSession, workloadId)).toBe(RolePermissionEnum.READWRITE);
        expect(UserGroupUtils.sessionHasReadAccessForProjectWorkload(regularSession, workloadId)).toBe(true);
        expect(UserGroupUtils.sessionHasWriteAccessForProjectWorkload(regularSession, workloadId)).toBe(true);
    });

    test("object-level workload permissions deny ungranted workloads", () => {
        setProjectPermission({
            workloadPermissions: [{ workloadId, permission: RolePermissionEnum.READWRITE }],
        });

        expect(UserGroupUtils.getRolePermissionForProjectWorkload(regularSession, otherWorkloadId)).toBeNull();
        expect(UserGroupUtils.sessionHasReadAccessForProjectWorkload(regularSession, otherWorkloadId)).toBe(false);
        expect(UserGroupUtils.sessionHasReadAccessToProject(regularSession, projectId)).toBe(true);
    });

    test("missing project permission denies project access", () => {
        expect(UserGroupUtils.sessionHasReadAccessToProject(regularSession, projectId)).toBe(false);
        expect(UserGroupUtils.sessionHasReadAccessForProjectWorkload(regularSession, workloadId)).toBe(false);
    });

    test("project-level create and delete workload permissions stay unchanged", () => {
        setProjectPermission({
            createWorkloads: true,
            deleteWorkloads: true,
            readWorkloads: true,
        });

        expect(UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(regularSession, projectId)).toBe(true);
        expect(UserGroupUtils.sessionCanDeleteProjectWorkloadsForProject(regularSession, projectId)).toBe(true);
    });
});
