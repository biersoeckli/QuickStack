import { Session } from "next-auth";
import { RolePermissionEnum } from "./role-extended.model.ts";

export interface UserSession {
    email: string;
    userGroup?: UserGroupExtended;
}

export type ProjectWorkloadPermission = {
    workloadId: string;
    permission: RolePermissionEnum | string;
};

export type ProjectRolePermission = {
    projectId: string;
    project: {
        projectWorkloads: {
            id: string;
            name: string;
        }[];
    };
    createWorkloads: boolean;
    deleteWorkloads: boolean;
    writeWorkloads: boolean;
    readWorkloads: boolean;
    workloadPermissions: ProjectWorkloadPermission[];
};

export type UserGroupExtended = {
    name: string;
    id: string;
    canAccessBackups: boolean;
    roleProjectPermissions: ProjectRolePermission[];
};
