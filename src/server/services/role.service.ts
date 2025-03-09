import { Prisma } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import { revalidateTag, unstable_cache } from "next/cache";
import { Tags } from "../utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { RoleEditModel } from "@/shared/model/role-edit.model";
import { adminRoleName } from "@/shared/model/role-extended.model.ts";

export class RoleService {

    async getRoleByUserMail(email: string) {
        return await unstable_cache(async (mail: string) => await dataAccess.client.user.findFirst({
            select: {
                role: {
                    select: {
                        name: true,
                        id: true,
                        canAccessBackups: true,
                        canCreateNewApps: true,
                        roleAppPermissions: {
                            select: {
                                appId: true,
                                permission: true
                            }
                        }
                    }
                }
            },
            where: {
                email: mail
            }
        }).then(user => {
            return user?.role ?? null;
        }),
            [Tags.roles(), Tags.users()], {
            tags: [Tags.roles(), Tags.users()]
        })(email);
    }

    async saveWithPermissions(item: RoleEditModel) {
        try {
            if (item.name === adminRoleName) {
                throw new ServiceException("You cannot assign the name 'admin' to a role");
            }
            if (item.id) {
                await dataAccess.client.role.update({
                    where: {
                        id: item.id as string
                    },
                    data: {
                        name: item.name,
                        canAccessBackups: item.canAccessBackups,
                        canCreateNewApps: item.canCreateNewApps,
                        roleAppPermissions: {
                            deleteMany: {},
                            createMany: {
                                data: item.roleAppPermissions?.map(p => ({
                                    appId: p.appId,
                                    permission: p.permission
                                })) || []
                            }
                        }
                    }
                });
            } else {
                await dataAccess.client.role.create({
                    data: {
                        name: item.name,
                        roleAppPermissions: {
                            createMany: {
                                data: item.roleAppPermissions?.map(p => ({
                                    appId: p.appId,
                                    permission: p.permission
                                })) || []
                            }
                        }
                    }
                });
            }
        } finally {
            revalidateTag(Tags.roles());
            revalidateTag(Tags.users());
        }
    }

    async save(item: Prisma.RoleUncheckedCreateInput | Prisma.RoleUncheckedUpdateInput) {
        try {
            if (item.name === adminRoleName) {
                throw new ServiceException("You cannot assign the name 'admin' to a role");
            }
            if (item.id) {
                await dataAccess.client.role.update({
                    where: {
                        id: item.id as string
                    },
                    data: item
                });
            } else {
                await dataAccess.client.role.create({
                    data: item as Prisma.RoleUncheckedCreateInput
                });
            }
        } finally {
            revalidateTag(Tags.roles());
            revalidateTag(Tags.users());
        }
    }

    async setRolePermissions(roleId: string, permissions: Prisma.RoleAppPermissionUncheckedCreateInput[]) {
        try {
            await dataAccess.client.$transaction(async tx => {
                await tx.roleAppPermission.deleteMany({
                    where: {
                        roleId
                    }
                });
                await tx.roleAppPermission.createMany({
                    data: permissions.map(p => ({
                        ...p,
                        roleId
                    }))
                });
            });
        } finally {
            revalidateTag(Tags.roles());
            revalidateTag(Tags.users());
        }
    }

    async getAll() {
        return await unstable_cache(async () => await dataAccess.client.role.findMany({
            include: {
                roleAppPermissions: {
                    include: {
                        app: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        }),
            [Tags.roles()], {
            tags: [Tags.roles()]
        })();
    }
    async getById(id: string) {
        return await unstable_cache(async () => await dataAccess.client.role.findFirstOrThrow({
            where: {
                id
            },
            include: {
                roleAppPermissions: true
            }
        }),
            [Tags.roles(), id], {
            tags: [Tags.roles()]
        })();
    }

    async assignUserToRole(userId: string, roleId: string) {
        try {
            await dataAccess.client.user.update({
                where: {
                    id: userId,
                },
                data: {
                    roleId,
                },
            });
        } finally {
            revalidateTag(Tags.roles());
            revalidateTag(Tags.users());
        }
    }

    async deleteById(id: string) {
        try {
            await dataAccess.client.role.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.roles());
            revalidateTag(Tags.users());
        }
    }

    async getOrCreateAdminRole() {
        let adminRole = await dataAccess.client.role.findFirst({
            where: {
                name: adminRoleName
            }
        });
        if (!adminRole) {
            adminRole = await dataAccess.client.role.create({
                data: {
                    name: adminRoleName
                }
            });
        }
        return adminRole;
    }

    async createDefaultRolesIfNotExists() {
        try {
            const roles = await dataAccess.client.role.findMany({
                where: {
                    name: {
                        in: [adminRoleName]
                    }
                }
            });
            if (roles.length === 0) {
                const adminRole = await this.getOrCreateAdminRole();
                await dataAccess.client.user.updateMany({
                    where: {
                        roleId: null
                    },
                    data: {
                        roleId: adminRole.id
                    }
                });
            }
        } finally {
            revalidateTag(Tags.roles());
            revalidateTag(Tags.users());
        }
    }
}

const roleService = new RoleService();
export default roleService;