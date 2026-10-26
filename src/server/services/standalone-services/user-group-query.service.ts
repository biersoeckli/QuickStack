import dataAccess from '../../adapter/db.client';
import type { ProjectRolePermission, UserGroupExtended } from '@/shared/model/sim-session.model';

type RoleProjectPermissionRecord = {
    projectId: string;
    project: {
        apps: {
            id: string;
            name: string;
        }[];
        agents: {
            id: string;
            name: string;
        }[];
    };
    createApps: boolean;
    deleteApps: boolean;
    writeApps: boolean;
    readApps: boolean;
    roleAppPermissions: {
        appId: string;
        permission: string;
    }[];
    roleAgentPermissions: {
        agentId: string;
        permission: string;
    }[];
};

class UserGroupQueryService {
    private mapProjectRolePermission(permission: RoleProjectPermissionRecord): ProjectRolePermission {
        const appWorkloads = permission.project.apps.map((app) => ({
            id: app.id,
            name: app.name,
        }));
        const agentWorkloads = permission.project.agents?.map((agent) => ({
            id: agent.id,
            name: agent.name,
        })) ?? [];

        const appPermissions = permission.roleAppPermissions.map((wp) => ({
            workloadId: wp.appId,
            permission: wp.permission,
        }));
        const agentPermissions = permission.roleAgentPermissions?.map((wp) => ({
            workloadId: wp.agentId,
            permission: wp.permission,
        })) ?? [];

        return {
            projectId: permission.projectId,
            project: {
                projectWorkloads: [...appWorkloads, ...agentWorkloads],
            },
            createWorkloads: permission.createApps,
            deleteWorkloads: permission.deleteApps,
            writeWorkloads: permission.writeApps,
            readWorkloads: permission.readApps,
            workloadPermissions: [...appPermissions, ...agentPermissions],
        };
    }

    async getRoleByUserMail(email: string): Promise<UserGroupExtended | null> {
        return await dataAccess.client.user.findFirst({
            select: {
                userGroup: {
                    select: {
                        name: true,
                        id: true,
                        canAccessBackups: true,
                        roleProjectPermissions: {
                            select: {
                                projectId: true,
                                project: {
                                    select: {
                                        apps: {
                                            select: {
                                                id: true,
                                                name: true,
                                            },
                                        },
                                        agents: {
                                            select: {
                                                id: true,
                                                name: true,
                                            },
                                        },
                                    },
                                },
                                createApps: true,
                                deleteApps: true,
                                writeApps: true,
                                readApps: true,
                                roleAppPermissions: true,
                                roleAgentPermissions: true,
                            },
                        },
                    },
                },
            },
            where: { email },
        }).then((user) => this.toExtendedRole(user?.userGroup));
    }

    async getAll(): Promise<UserGroupExtended[]> {
        const groups = await dataAccess.client.userGroup.findMany({
            include: this.roleProjectPermissionsInclude(),
        });
        return groups.map((group) => this.toExtendedRole(group)!);
    }

    async getById(id: string): Promise<UserGroupExtended> {
        const group = await dataAccess.client.userGroup.findFirstOrThrow({
            where: { id },
            include: this.roleProjectPermissionsInclude(),
        });
        return this.toExtendedRole(group)!;
    }

    private roleProjectPermissionsInclude() {
        return {
            roleProjectPermissions: {
                select: {
                    projectId: true,
                    project: {
                        select: {
                            apps: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                            agents: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    createApps: true,
                    deleteApps: true,
                    writeApps: true,
                    readApps: true,
                    roleAppPermissions: true,
                    roleAgentPermissions: true,
                },
            },
        };
    }

    private toExtendedRole<T extends Pick<UserGroupExtended, 'name' | 'id' | 'canAccessBackups'> & {
        roleProjectPermissions: RoleProjectPermissionRecord[];
    }>(role: T | null | undefined): UserGroupExtended | null {
        if (!role) {
            return null;
        }
        return {
            ...role,
            roleProjectPermissions: role.roleProjectPermissions.map((permission) => this.mapProjectRolePermission(permission)),
        };
    }
}

const userGroupQueryService = new UserGroupQueryService();
export default userGroupQueryService;
