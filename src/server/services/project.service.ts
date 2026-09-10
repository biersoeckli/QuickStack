import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Project } from "@prisma/client";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import namespaceService from "./namespace.service";
import buildService from "./build.service";
import { ProjectExtendedModel, ProjectNavigationModel, ProjectWithCountsModel } from "@/shared/model/project-extended.model";
import { ProjectType, ProjectTypeModel } from "@/shared/model/project-type.model";
import { ServiceException } from "@/shared/model/service.exception.model";

type ProjectSaveInput = {
    id?: string;
    name: string;
    projectType?: ProjectType;
};

class ProjectService {

    async deleteById(projectid: string) {
        const existingItem = await this.getById(projectid);
        if (!existingItem) {
            return;
        }
        try {
            await buildService.deleteAllBuildsOfProject(existingItem.id);
            await namespaceService.deleteNamespace(existingItem.id);
            await dataAccess.client.project.delete({
                where: {
                    id: projectid
                }
            });
        } finally {
            revalidateTag(Tags.projects());
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
    }

    async getAll(): Promise<ProjectExtendedModel[]> {
        return await unstable_cache(() => dataAccess.client.project.findMany({
            include: {
                apps: true,
                agents: true,
            },
            orderBy: {
                name: 'asc'
            }
        }),
            [Tags.projects()], {
            tags: [Tags.projects()]
        })();
    }

    async getAllForNavigation(): Promise<ProjectNavigationModel[]> {
        return await unstable_cache(() => dataAccess.client.project.findMany({
            select: {
                id: true,
                name: true,
                projectType: true,
                createdAt: true,
                updatedAt: true,
                apps: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                agents: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
            },
            orderBy: {
                name: 'asc'
            }
        }),
            [Tags.projects(), 'navigation'], {
            tags: [Tags.projects()]
        })();
    }

    async getAllWithCounts(): Promise<ProjectWithCountsModel[]> {
        return await unstable_cache(() => dataAccess.client.project.findMany({
            select: {
                id: true,
                name: true,
                projectType: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        apps: true,
                        agents: true,
                    }
                },
            },
            orderBy: {
                name: 'asc'
            }
        }),
            [Tags.projects(), 'counts'], {
            tags: [Tags.projects()]
        })();
    }

    async getById(id: string) {
        return dataAccess.client.project.findFirstOrThrow({
            where: {
                id
            }
        });
    }

    async getByIdOrUndefined(id: string) {
        return dataAccess.client.project.findFirst({
            where: {
                id
            }
        });
    }

    async save(item: ProjectSaveInput) {
        let savedItem: Project;
        try {
            if (item.id) {
                const existingItem = await this.getById(item.id);
                if (item.projectType && item.projectType !== existingItem.projectType) {
                    throw new ServiceException("Project Type cannot be changed.");
                }
                savedItem = await dataAccess.client.project.update({
                    where: {
                        id: item.id
                    },
                    data: { name: item.name }
                });
            } else {
                const projectType = ProjectTypeModel.safeParse(item.projectType);
                if (!projectType.success) {
                    throw new ServiceException("Project Type is required.");
                }
                item.id = KubeObjectNameUtils.toProjectId(item.name);
                savedItem = await dataAccess.client.project.create({
                    data: {
                        id: item.id,
                        name: item.name,
                        projectType: projectType.data,
                    }
                });
            }
            await namespaceService.createNamespaceIfNotExists(savedItem.id);
        } finally {
            revalidateTag(Tags.projects());
        }
        return savedItem;
    }
}

const projectService = new ProjectService();
export default projectService;
