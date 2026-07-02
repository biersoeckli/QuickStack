'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import projectService from "@/server/services/project.service";
import ProjectOverview from "./project-overview";
import appService from "@/server/services/app.service";
import agentService from "@/server/services/agent.service";
import PageTitle from "@/components/custom/page-title";
import ProjectBreadcrumbs from "./project-breadcrumbs";
import CreateProjectActions from "./create-project-actions";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import AgentListClient from "./agent-list-client";

export default async function AppsPage({
    searchParams,
    params
}: {
    searchParams?: Promise<{ [key: string]: string | undefined }>;
    params: Promise<{ projectId: string }>
}) {
    const resolvedParams = await params;
    const session = await getAuthUserSession();

    const projectId = resolvedParams?.projectId;
    if (!projectId) {
        return <p>Could not find project with id {projectId}</p>
    }
    const project = await projectService.getById(projectId);
    const isAgentProject = project.projectType === 'AGENT';

    if (isAgentProject) {
        const agents = await agentService.getAllByProjectId(projectId);
        return (
            <div className="flex-1 space-y-4 pt-6">
                <PageTitle
                    title="Agents"
                    subtitle={`Agent Project "${project.name}"`}>
                    {UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(session, projectId) &&
                        <CreateProjectActions projectId={projectId} projectType="agent" />}
                </PageTitle>
                <AgentListClient agents={agents} session={session} projectId={projectId} />
                <ProjectBreadcrumbs project={project} />
            </div>
        );
    }

    const data = await appService.getAllAppsByProjectID(projectId);
    const relevantApps = data.filter((app) =>
        UserGroupUtils.sessionHasReadAccessForApp(session, app.id));

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title="Apps"
                subtitle={`App Project "${project.name}"`}>
                {UserGroupUtils.sessionCanCreateNewAppsForProject(session, projectId) &&
                    <CreateProjectActions projectId={projectId} projectType="app" />}
            </PageTitle>
            <ProjectOverview session={session} apps={relevantApps} projectId={project.id} />
            <ProjectBreadcrumbs project={project} />
        </div>
    )
}
