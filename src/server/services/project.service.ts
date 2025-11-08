import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Prisma, Project } from "@prisma/client";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import deploymentService from "./deployment.service";
import namespaceService from "./namespace.service";
import buildService from "./build.service";
import { ProjectExtendedModel } from "@/shared/model/project-extended.model";

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

    async getAllProjects(): Promise<ProjectExtendedModel[]> {
        return await unstable_cache(() => dataAccess.client.project.findMany({
            include: {
                apps: true
            },
            orderBy: {
                name: 'asc'
            }
        }),
            [Tags.projects()], {
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

    async save(item: Prisma.ProjectUncheckedCreateInput | Prisma.ProjectUncheckedUpdateInput) {
        let savedItem: Project;
        try {
            if (item.id) {
                savedItem = await dataAccess.client.project.update({
                    where: {
                        id: item.id as string
                    },
                    data: item
                });
            } else {
                item.id = KubeObjectNameUtils.toProjectId(item.name as string);
                savedItem = await dataAccess.client.project.create({
                    data: item as Prisma.ProjectUncheckedCreateInput
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
