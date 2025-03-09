import { adminRoleName, RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { UserSession } from "@/shared/model/sim-session.model";

export class RoleUtils {

    static sessionHasReadAccessToProject(session: UserSession, project: { apps: { id: string; }[] }) {
        if (project.apps.length === 0 && RoleUtils.sessionCanCreateNewApps(session)) {
            return true;
        }
        return project.apps.some((app) => RoleUtils.sessionHasReadAccessForApp(session, app.id))
    }

    static getRolePermissionForApp(session: UserSession, appId: string) {
        if (this.isAdmin(session)) {
            return RolePermissionEnum.READWRITE;
        }
        return (session.permissions?.find(app => app.appId === appId)?.permission ?? null) as RolePermissionEnum | null;
    }

    static sessionHasAccessToBackups(session: UserSession) {
        if (this.isAdmin(session)) {
            return true;
        }
        return !!session.canAccessBackups;
    }

    static sessionCanCreateNewApps(session: UserSession) {
        if (this.isAdmin(session)) {
            return true;
        }
        return !!session.canCreateNewApps;
    }

    static sessionIsReadOnlyForApp(session: UserSession, appId: string) {
        if (this.isAdmin(session)) {
            return false;
        }
        const rolePermission = this.getRolePermissionForApp(session, appId);
        const roleHasReadAccessForApp = rolePermission === RolePermissionEnum.READ;
        const roleHasWriteAccessForApp = rolePermission === RolePermissionEnum.READWRITE;
        return !!roleHasReadAccessForApp && !roleHasWriteAccessForApp;
    }

    static sessionHasReadAccessForApp(session: UserSession, appId: string) {
        if (this.isAdmin(session)) {
            return true;
        }
        const rolePermission = this.getRolePermissionForApp(session, appId);
        const roleHasReadAccessForApp = rolePermission === RolePermissionEnum.READ || rolePermission === RolePermissionEnum.READWRITE;
        return !!roleHasReadAccessForApp;
    }

    static sessionHasWriteAccessForApp(session: UserSession, appId: string) {
        if (this.isAdmin(session)) {
            return true;
        }
        const rolePermission = this.getRolePermissionForApp(session, appId);
        const roleHasReadAccessForApp = rolePermission === RolePermissionEnum.READWRITE;
        return roleHasReadAccessForApp;
    }

    static isAdmin(session: UserSession) {
        return session.roleName === adminRoleName;
    }
}