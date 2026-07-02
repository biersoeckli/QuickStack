'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import projectService from "@/server/services/project.service";
import { getAdminUserSession, getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { z } from "zod";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { ProjectTypeModel } from "@/shared/model/project-type.model";

const createProjectSchema = z.object({
    projectName: z.string().min(1),
    projectType: ProjectTypeModel,
    projectId: z.string().optional()
});

export const createProject = async (projectName: string, projectType: string, projectId?: string) =>
    saveFormAction({ projectName, projectType, projectId }, createProjectSchema, async (validatedData) => {
        const session = await getAdminUserSession();
        await projectService.save({
            id: validatedData.projectId ?? undefined,
            name: validatedData.projectName,
            projectType: validatedData.projectType,
        });
        return new SuccessActionResult(undefined, "Project created successfully.");
    });

export const deleteProject = async (projectId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await projectService.deleteById(projectId);
        return new SuccessActionResult(undefined, "Project deleted successfully.");
    });
