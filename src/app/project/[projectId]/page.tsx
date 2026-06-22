'use server'


import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import projectService from "@/server/services/project.service";
import ProjectOverview from "./project-overview";
import appService from "@/server/services/app.service";
import PageTitle from "@/components/custom/page-title";
import ProjectBreadcrumbs from "./project-breadcrumbs";
import CreateProjectActions from "./create-project-actions";
import { UserGroupUtils } from "@/shared/utils/role.utils";

export default async function AppsPage({
    searchParams,
    params
}: {
    searchParams?: { [key: string]: string | undefined };
    params: { projectId: string }
}) {
    const session = await getAuthUserSession();

    const projectId = params?.projectId;
    if (!projectId) {
        return <p>Could not find project with id {projectId}</p>
    }
    const project = await projectService.getById(projectId);
    const isAgentProject = project.projectType === 'AGENT';
    const data = isAgentProject ? [] : await appService.getAllAppsByProjectID(projectId);
    const relevantApps = data.filter((app) =>
        UserGroupUtils.sessionHasReadAccessForApp(session, app.id));

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={isAgentProject ? "Agents" : "Apps"}
                subtitle={`${isAgentProject ? 'Agent' : 'App'} Project "${project.name}"`}>
                {!isAgentProject && UserGroupUtils.sessionCanCreateNewAppsForProject(session, params.projectId) &&
                    <CreateProjectActions projectId={projectId} />}
            </PageTitle>
            {isAgentProject
                ? <div className="rounded-lg border border-dashed p-12 text-center">
                    <h3 className="text-lg font-semibold">No Agents yet</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Agents created in this Agent Project will appear here.
                    </p>
                </div>
                : <ProjectOverview session={session} apps={relevantApps} projectId={project.id} />}
            <ProjectBreadcrumbs project={project} />
        </div>
    )
}
