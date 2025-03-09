import { Role, RoleAppPermission, User } from "@prisma/client";

export type RoleExtended = Role & {
    roleAppPermissions: (RoleAppPermission & {
        app: {
            name: string;
        };
    })[];
}

export enum RolePermissionEnum {
    READ = 'READ',
    READWRITE = 'READWRITE'
}


export const adminRoleName = "admin";