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
    const data = await appService.getAllAppsByProjectID(projectId);
    const relevantApps = data.filter((app) =>
        UserGroupUtils.sessionHasReadAccessForApp(session, app.id));

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title="Apps"
                subtitle={`All Apps for Project "${project.name}"`}>
                {UserGroupUtils.sessionCanCreateNewAppsForProject(session, params.projectId) &&
                    <CreateProjectActions projectId={projectId} />}
            </PageTitle>
            <ProjectOverview session={session} apps={relevantApps} projectId={project.id} />
            <ProjectBreadcrumbs project={project} />
        </div>
    )
}
