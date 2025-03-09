'use server'

import { Button } from "@/components/ui/button";

import Link from "next/link";
import { getAuthUserSession, getUserSession } from "@/server/utils/action-wrapper.utils";
import projectService from "@/server/services/project.service";
import ProjectsTable from "./projects-table";
import { EditProjectDialog } from "./edit-project-dialog";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useBreadcrumbs } from "@/frontend/states/zustand.states";
import ProjectsBreadcrumbs from "./projects-breadcrumbs";
import { Plus } from "lucide-react";
import { RoleUtils } from "@/shared/utils/role.utils";

export default async function ProjectPage() {

    const session = await getAuthUserSession();
    const data = await projectService.getAllProjects();
    const relevantProjectsForUser = data.filter((project) =>
        RoleUtils.sessionHasReadAccessToProject(session, project));

    return (
        <div className="flex-1 space-y-4 pt-6">
            <div className="flex gap-4">
                <h2 className="text-3xl font-bold tracking-tight flex-1">Projects</h2>
                {RoleUtils.isAdmin(session) && <EditProjectDialog>
                    <Button><Plus /> Create Project</Button>
                </EditProjectDialog>}
            </div>
            <ProjectsTable data={relevantProjectsForUser} />
            <ProjectsBreadcrumbs />
        </div>
    )
}
