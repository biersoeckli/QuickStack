'use server'

import { Button } from "@/components/ui/button";

import Link from "next/link";
import { getAuthUserSession, getUserSession } from "@/server/utils/action-wrapper.utils";
import projectService from "@/server/services/project.service";
import ProjectsTable from "./projects-table";
import { EditProjectDialog } from "./edit-project-dialog";
import ProjectsBreadcrumbs from "./projects-breadcrumbs";
import { Plus } from "lucide-react";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import agentService from "@/server/services/agent.service";

export default async function ProjectPage() {

    const session = await getAuthUserSession();
    const data = await projectService.getAll();
    const agentsAvailable = await agentService.agentCrdAreInstalled();
    const relevantProjectsForUser = data.filter((project) =>
        UserGroupUtils.sessionHasReadAccessToProject(session, project.id));

    return (
        <div className="flex-1 space-y-4 pt-6">
            <div className="flex gap-4">
                <h2 className="text-3xl font-bold tracking-tight flex-1">Projects</h2>
                {UserGroupUtils.isAdmin(session) && <EditProjectDialog agentsAvailable={agentsAvailable}>
                    <Button><Plus /> Create Project</Button>
                </EditProjectDialog>}
            </div>
            <ProjectsTable session={session} data={relevantProjectsForUser} agentsAvailable={agentsAvailable} />
            <ProjectsBreadcrumbs />
        </div>
    )
}
