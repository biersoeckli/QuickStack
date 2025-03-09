'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import projectService from "@/server/services/project.service";
import { getAdminUserSession, getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { z } from "zod";
import { RoleUtils } from "@/shared/utils/role.utils";
import { ServiceException } from "@/shared/model/service.exception.model";

const createProjectSchema = z.object({
    projectName: z.string().min(1),
    projectId: z.string().optional()
});

export const createProject = async (projectName: string, projectId?: string) =>
    saveFormAction({ projectName, projectId }, createProjectSchema, async (validatedData) => {
       const session = await getAuthUserSession();
        if (!RoleUtils.sessionCanCreateNewApps(session)) {
            throw new ServiceException("You are not allowed to create new projects.");
        }
        await projectService.save({
            id: validatedData.projectId ?? undefined,
            name: validatedData.projectName
        });
        return new SuccessActionResult(undefined, "Project created successfully.");
    });

export const deleteProject = async (projectId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await projectService.deleteById(projectId);
        return new SuccessActionResult(undefined, "Project deleted successfully.");
    });