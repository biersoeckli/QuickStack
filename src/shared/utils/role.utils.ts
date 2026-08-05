import { adminRoleName, RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { UserSession } from "@/shared/model/sim-session.model";

export class UserGroupUtils {

    static sessionHasReadAccessToProject(session: UserSession, projectId: string) {
        if (this.isAdmin(session)) {
            return true;
        }

        const projectPermission = UserGroupUtils.getProjectPermissionForProjectId(session, projectId);
        if (!projectPermission) {
            return false;
        }

        if (projectPermission.workloadPermissions.length > 0) {
            return true;
        }

        return projectPermission.readWorkloads;
    }

    private static getProjectPermissionForProjectId(session: UserSession, projectId: string) {
        return session.userGroup?.roleProjectPermissions?.find((projectPermission) => projectPermission.projectId === projectId);
    }

    private static getProjectPermissionForWorkloadId(session: UserSession, workloadId: string) {
        return session.userGroup?.roleProjectPermissions?.find((projectPermission) => {
            return projectPermission.project?.projectWorkloads?.some(workload => workload.id === workloadId);
        });
    }

    static getRolePermissionForProjectWorkload(session: UserSession, workloadId: string): RolePermissionEnum | null {
        if (this.isAdmin(session)) {
            return RolePermissionEnum.READWRITE;
        }
        const projectPermission = this.getProjectPermissionForWorkloadId(session, workloadId);
        if (!projectPermission) {
            return null;
        }
        if (projectPermission.workloadPermissions.length > 0) {
            return (projectPermission.workloadPermissions.find(workload => workload.workloadId === workloadId)?.permission ?? null) as RolePermissionEnum | null;
        }
        if (projectPermission.writeWorkloads) {
            return RolePermissionEnum.READWRITE;
        }
        if (projectPermission.readWorkloads) {
            return RolePermissionEnum.READ;
        }
        return null;
    }

    static getRolePermissionForApp(session: UserSession, appId: string): RolePermissionEnum | null {
        return this.getRolePermissionForProjectWorkload(session, appId);
    }

    static getRolePermissionForAgent(session: UserSession, agentId: string): RolePermissionEnum | null {
        return this.getRolePermissionForProjectWorkload(session, agentId);
    }

    static sessionHasAccessToBackups(session: UserSession) {
        if (this.isAdmin(session)) {
            return true;
        }
        return !!session.userGroup?.canAccessBackups;
    }

    static sessionCanCreateProjectWorkloadsForProject(session: UserSession, projectId: string) {
        if (this.isAdmin(session)) {
            return true;
        }
        const projectPermission = this.getProjectPermissionForProjectId(session, projectId);
        if (!projectPermission) {
            return false;
        }
        return !!projectPermission.createWorkloads;
    }

    static sessionCanCreateNewAppsForProject(session: UserSession, projectId: string) {
        return this.sessionCanCreateProjectWorkloadsForProject(session, projectId);
    }

    static sessionCanCreateNewAgentsForProject(session: UserSession, projectId: string) {
        return this.sessionCanCreateProjectWorkloadsForProject(session, projectId);
    }

    static sessionCanDeleteProjectWorkloadsForProject(session: UserSession, projectId: string) {
        if (this.isAdmin(session)) {
            return true;
        }
        const projectPermission = this.getProjectPermissionForProjectId(session, projectId);
        if (!projectPermission) {
            return false;
        }
        return !!projectPermission.deleteWorkloads;
    }

    static sessionCanDeleteAppsForProject(session: UserSession, projectId: string) {
        return this.sessionCanDeleteProjectWorkloadsForProject(session, projectId);
    }

    static sessionCanDeleteAgentsForProject(session: UserSession, projectId: string) {
        return this.sessionCanDeleteProjectWorkloadsForProject(session, projectId);
    }

    static sessionIsReadOnlyForProjectWorkload(session: UserSession, workloadId: string) {
        if (this.isAdmin(session)) {
            return false;
        }
        const rolePermission = this.getRolePermissionForProjectWorkload(session, workloadId);
        const hasReadAccess = rolePermission === RolePermissionEnum.READ;
        const hasWriteAccess = rolePermission === RolePermissionEnum.READWRITE;
        return !!hasReadAccess && !hasWriteAccess;
    }

    static sessionIsReadOnlyForApp(session: UserSession, appId: string) {
        return this.sessionIsReadOnlyForProjectWorkload(session, appId);
    }

    static sessionIsReadOnlyForAgent(session: UserSession, agentId: string) {
        return this.sessionIsReadOnlyForProjectWorkload(session, agentId);
    }

    static sessionHasReadAccessForProjectWorkload(session: UserSession, workloadId: string) {
        if (this.isAdmin(session)) {
            return true;
        }
        const rolePermission = this.getRolePermissionForProjectWorkload(session, workloadId);
        return rolePermission === RolePermissionEnum.READ || rolePermission === RolePermissionEnum.READWRITE;
    }

    static sessionHasReadAccessForApp(session: UserSession, appId: string) {
        return this.sessionHasReadAccessForProjectWorkload(session, appId);
    }

    static sessionHasReadAccessForAgent(session: UserSession, agentId: string) {
        return this.sessionHasReadAccessForProjectWorkload(session, agentId);
    }

    static sessionHasWriteAccessForProjectWorkload(session: UserSession, workloadId: string) {
        if (this.isAdmin(session)) {
            return true;
        }
        return this.getRolePermissionForProjectWorkload(session, workloadId) === RolePermissionEnum.READWRITE;
    }

    static sessionHasWriteAccessForApp(session: UserSession, appId: string) {
        return this.sessionHasWriteAccessForProjectWorkload(session, appId);
    }

    static sessionHasWriteAccessForAgent(session: UserSession, agentId: string) {
        return this.sessionHasWriteAccessForProjectWorkload(session, agentId);
    }

    static isAdmin(session: UserSession) {
        return session.userGroup?.name === adminRoleName;
    }
}
