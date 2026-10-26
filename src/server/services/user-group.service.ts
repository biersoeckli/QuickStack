import { Prisma, UserGroup } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import { revalidateTag, unstable_cache } from "next/cache";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { RoleEditModel } from "@/shared/model/role-edit.model";
import { adminRoleName } from "@/shared/model/role-extended.model";
import type { UserGroupExtended } from "@/shared/model/sim-session.model";
import userGroupQueryService from './standalone-services/user-group-query.service';

export class UserGroupService {
    async getRoleByUserMail(email: string): Promise<UserGroupExtended | null> {
        return unstable_cache(
            (mail: string) => userGroupQueryService.getRoleByUserMail(mail),
            [Tags.userGroups(), Tags.users()],
            { tags: [Tags.userGroups(), Tags.users()] },
        )(email);
    }

    async saveWithPermissions(item: RoleEditModel) {
        try {
            if (item.name === adminRoleName) {
                throw new ServiceException("You cannot assign the name 'admin' to a role");
            }
            await dataAccess.client.$transaction(async tx => {
                // save role first

                let savedRole: UserGroup;
                if (item.id) {
                    savedRole = await tx.userGroup.update({
                        where: {
                            id: item.id as string
                        },
                        data: {
                            name: item.name,
                            canAccessBackups: item.canAccessBackups,
                        }
                    });
                } else {
                    savedRole = await tx.userGroup.create({
                        data: {
                            name: item.name,
                            canAccessBackups: item.canAccessBackups,
                        }
                    });
                }

                // save project and workload permissions

                await tx.roleProjectPermission.deleteMany({
                    where: {
                        userGroupId: savedRole.id
                    }
                });

                for (let projectRolePermission of item.roleProjectPermissions) {
                    const forThisProjectCustomWorkloadRolesExist = projectRolePermission.workloadPermissions.length > 0;
                    const projectRolePermissionData = {
                        userGroupId: savedRole.id,
                        projectId: projectRolePermission.projectId,
                        createApps: forThisProjectCustomWorkloadRolesExist ? false : projectRolePermission.createWorkloads,
                        deleteApps: forThisProjectCustomWorkloadRolesExist ? false : projectRolePermission.deleteWorkloads,
                        writeApps: forThisProjectCustomWorkloadRolesExist ? false : projectRolePermission.writeWorkloads,
                        readApps: projectRolePermission.readWorkloads
                    };
                    const savedProjectRolePermission = await tx.roleProjectPermission.create({
                        data: projectRolePermissionData
                    });

                    const project = await tx.project.findFirstOrThrow({
                        where: { id: projectRolePermission.projectId },
                        select: {
                            apps: { select: { id: true } },
                            agents: { select: { id: true } },
                        },
                    });
                    const appIds = new Set(project.apps.map((a) => a.id));
                    const agentIds = new Set(project.agents.map((a) => a.id));

                    const appPermissions = projectRolePermission.workloadPermissions.filter((wp) => appIds.has(wp.workloadId));
                    const agentPermissions = projectRolePermission.workloadPermissions.filter((wp) => agentIds.has(wp.workloadId));

                    await tx.roleAppPermission.deleteMany({
                        where: {
                            roleProjectPermissionId: savedProjectRolePermission.id
                        }
                    });
                    await tx.roleAppPermission.createMany({
                        data: appPermissions.map((wp) => ({
                            appId: wp.workloadId,
                            permission: wp.permission,
                            roleProjectPermissionId: savedProjectRolePermission.id
                        }))
                    });

                    await tx.roleAgentPermission.deleteMany({
                        where: {
                            roleProjectPermissionId: savedProjectRolePermission.id
                        }
                    });
                    await tx.roleAgentPermission.createMany({
                        data: agentPermissions.map((wp) => ({
                            agentId: wp.workloadId,
                            permission: wp.permission,
                            roleProjectPermissionId: savedProjectRolePermission.id
                        }))
                    });
                }
            });
        } finally {
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
    }

    async save(item: Prisma.UserGroupUncheckedCreateInput | Prisma.UserGroupUncheckedUpdateInput) {
        try {
            if (item.name === adminRoleName) {
                throw new ServiceException("You cannot assign the name 'admin' to a role");
            }
            if (item.id) {
                await dataAccess.client.userGroup.update({
                    where: {
                        id: item.id as string
                    },
                    data: item
                });
            } else {
                await dataAccess.client.userGroup.create({
                    data: item as Prisma.UserGroupUncheckedCreateInput
                });
            }
        } finally {
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
    }

    async getAll(): Promise<UserGroupExtended[]> {
        return await unstable_cache(() => userGroupQueryService.getAll(),
            [Tags.userGroups()], {
            tags: [Tags.userGroups()]
        })();
    }
    async getById(id: string): Promise<UserGroupExtended> {
        return await unstable_cache(() => userGroupQueryService.getById(id),
            [Tags.userGroups(), id], {
            tags: [Tags.userGroups()]
        })();
    }

    async assignUserToRole(userId: string, userGroupId: string) {
        try {
            await dataAccess.client.user.update({
                where: {
                    id: userId,
                },
                data: {
                    userGroupId,
                },
            });
        } finally {
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
    }

    async deleteById(id: string) {
        try {
            await dataAccess.client.userGroup.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
    }

    async getOrCreateAdminRole() {
        let adminRole = await dataAccess.client.userGroup.findFirst({
            where: {
                name: adminRoleName
            }
        });
        if (!adminRole) {
            adminRole = await dataAccess.client.userGroup.create({
                data: {
                    name: adminRoleName
                }
            });
        }
        return adminRole;
    }

    async createDefaultRolesIfNotExists() {
        try {
            const dbAdminRole = await dataAccess.client.userGroup.findFirst({
                where: {
                    name: {
                        in: [adminRoleName]
                    }
                },
                include: {
                    users: true
                }
            });
            if (!dbAdminRole) {
                console.warn("*** No admin users found. Creating default admin role ***");
                const adminRole = await this.getOrCreateAdminRole();
                await dataAccess.client.user.updateMany({
                    where: {
                        userGroupId: null
                    },
                    data: {
                        userGroupId: adminRole.id
                    }
                });
                return;
            }

            if (dbAdminRole.users.length === 0) {
                // making all users to admins
                console.warn("*** No admin users found. Assigning all users to admin role ***");
                const adminRole = await this.getOrCreateAdminRole();
                await dataAccess.client.user.updateMany({
                    data: {
                        userGroupId: adminRole.id
                    }
                });
                return;
            }
        } finally {
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
    }
}

const userGroupService = new UserGroupService();
export default userGroupService;
