import { RoleUtils } from "../../../shared/utils/role.utils";
import { adminRoleName, RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { UserSession } from "@/shared/model/sim-session.model";

describe(RoleUtils.name, () => {
    let adminSession: UserSession;
    let regularSession: UserSession;

    beforeEach(() => {
        adminSession = {
            roleName: adminRoleName,
            permissions: [],
            canAccessBackups: false,
            canCreateNewApps: false,
        } as any;

        regularSession = {
            roleName: "user",
            permissions: [],
            canAccessBackups: false,
            canCreateNewApps: false,
        } as any;
    });

    describe("isAdmin", () => {
        it("should return true for admin session", () => {
            expect(RoleUtils.isAdmin(adminSession)).toBe(true);
        });

        it("should return false for non-admin session", () => {
            expect(RoleUtils.isAdmin(regularSession)).toBe(false);
        });
    });

    describe("getRolePermissionForApp", () => {
        it("should return READWRITE for admin regardless of permission", () => {
            expect(RoleUtils.getRolePermissionForApp(adminSession, "app1")).toBe(
                RolePermissionEnum.READWRITE
            );
        });

        it("should return null for non-admin without permission", () => {
            expect(RoleUtils.getRolePermissionForApp(regularSession, "app1")).toBe(null);
        });

        it("should return the specific permission for non-admin with permission", () => {
            regularSession.permissions = [{ appId: "app1", permission: RolePermissionEnum.READ }];
            expect(RoleUtils.getRolePermissionForApp(regularSession, "app1")).toBe(
                RolePermissionEnum.READ
            );
        });
    });

    describe("sessionHasAccessToBackups", () => {
        it("should return true for admin session", () => {
            expect(RoleUtils.sessionHasAccessToBackups(adminSession)).toBe(true);
        });

        it("should return true for non-admin with backups access", () => {
            regularSession.canAccessBackups = true;
            expect(RoleUtils.sessionHasAccessToBackups(regularSession)).toBe(true);
        });

        it("should return false for non-admin without backups access", () => {
            expect(RoleUtils.sessionHasAccessToBackups(regularSession)).toBe(false);
        });
    });

    describe("sessionCanCreateNewApps", () => {
        it("should return true for admin session", () => {
            expect(RoleUtils.sessionCanCreateNewApps(adminSession)).toBe(true);
        });

        it("should return true for non-admin with ability to create new apps", () => {
            regularSession.canCreateNewApps = true;
            expect(RoleUtils.sessionCanCreateNewApps(regularSession)).toBe(true);
        });

        it("should return false for non-admin without ability to create new apps", () => {
            expect(RoleUtils.sessionCanCreateNewApps(regularSession)).toBe(false);
        });
    });

    describe("sessionIsReadOnlyForApp", () => {
        it("should return false for admin session", () => {
            expect(RoleUtils.sessionIsReadOnlyForApp(adminSession, "app1")).toBe(false);
        });

        it("should return true for non-admin with READ permission only", () => {
            regularSession.permissions = [{ appId: "app1", permission: RolePermissionEnum.READ }];
            expect(RoleUtils.sessionIsReadOnlyForApp(regularSession, "app1")).toBe(true);
        });

        it("should return false for non-admin with READWRITE permission", () => {
            regularSession.permissions = [{ appId: "app1", permission: RolePermissionEnum.READWRITE }];
            expect(RoleUtils.sessionIsReadOnlyForApp(regularSession, "app1")).toBe(false);
        });

        it("should return false when no permission is assigned", () => {
            regularSession.permissions = [];
            expect(RoleUtils.sessionIsReadOnlyForApp(regularSession, "app1")).toBe(false);
        });
    });

    describe("sessionHasReadAccessForApp", () => {
        it("should return true for admin session", () => {
            expect(RoleUtils.sessionHasReadAccessForApp(adminSession, "app1")).toBe(true);
        });

        it("should return true for non-admin with READ permission", () => {
            regularSession.permissions = [{ appId: "app1", permission: RolePermissionEnum.READ }];
            expect(RoleUtils.sessionHasReadAccessForApp(regularSession, "app1")).toBe(true);
        });

        it("should return true for non-admin with READWRITE permission", () => {
            regularSession.permissions = [{ appId: "app1", permission: RolePermissionEnum.READWRITE }];
            expect(RoleUtils.sessionHasReadAccessForApp(regularSession, "app1")).toBe(true);
        });

        it("should return false when no permission is granted", () => {
            regularSession.permissions = [];
            expect(RoleUtils.sessionHasReadAccessForApp(regularSession, "app1")).toBe(false);
        });
    });

    describe("sessionHasWriteAccessForApp", () => {
        it("should return true for admin session", () => {
            expect(RoleUtils.sessionHasWriteAccessForApp(adminSession, "app1")).toBe(true);
        });

        it("should return true for non-admin with READWRITE permission", () => {
            regularSession.permissions = [{ appId: "app1", permission: RolePermissionEnum.READWRITE }];
            expect(RoleUtils.sessionHasWriteAccessForApp(regularSession, "app1")).toBe(true);
        });

        it("should return false for non-admin with only READ permission", () => {
            regularSession.permissions = [{ appId: "app1", permission: RolePermissionEnum.READ }];
            expect(RoleUtils.sessionHasWriteAccessForApp(regularSession, "app1")).toBe(false);
        });

        it("should return false when no permission is assigned", () => {
            regularSession.permissions = [];
            expect(RoleUtils.sessionHasWriteAccessForApp(regularSession, "app1")).toBe(false);
        });
    });

    describe("sessionHasReadAccessToProject", () => {
        it("should return true if project has no apps and session can create new apps", () => {
            regularSession.canCreateNewApps = true;
            const project = { apps: [] };
            expect(RoleUtils.sessionHasReadAccessToProject(regularSession, project)).toBe(true);
        });

        it("should return true if project has no apps and session is admin", () => {
            const project = { apps: [] };
            expect(RoleUtils.sessionHasReadAccessToProject(adminSession, project)).toBe(true);
        });

        it("should return true if at least one app grants read access", () => {
            const project = { apps: [{ id: "app1" }, { id: "app2" }] };
            regularSession.permissions = [{ appId: "app2", permission: RolePermissionEnum.READ }];
            expect(RoleUtils.sessionHasReadAccessToProject(regularSession, project)).toBe(true);
        });

        it("should return false if no app grants read access", () => {
            const project = { apps: [{ id: "app1" }] };
            regularSession.permissions = [];
            expect(RoleUtils.sessionHasReadAccessToProject(regularSession, project)).toBe(false);
        });
    });
});