import { RoleAppPermission } from "@prisma/client";
import { Session } from "next-auth";
import { RolePermissionEnum } from "./role-extended.model.ts";

export interface UserSession {
    email: string;
    roleName?: string;
    roleId?: string;
    permissions?: {
        appId: string,
        permission: RolePermissionEnum
    }[];
}
