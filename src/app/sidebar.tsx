import projectService from "@/server/services/project.service"
import { getUserSession } from "@/server/utils/action-wrapper.utils"
import { SidebarCient } from "./sidebar-client"
import { UserGroupUtils } from "@/shared/utils/role.utils";
import quickStackUpdateService from "@/server/services/qs-update.service";
import agentService from "@/server/services/agent.service";

export async function AppSidebar() {

  const session = await getUserSession();

  if (!session) {
    return <></>
  }

  const projects = await projectService.getAll();
  const newVersionInfo = await quickStackUpdateService.getNewVersionInfo();
  const agentsAvailable = await agentService.agentCrdAreInstalled();
  const relevantProjectsForUser = projects.filter((project) =>
    UserGroupUtils.sessionHasReadAccessToProject(session, project.id));
  for (const project of relevantProjectsForUser) {
    project.apps = project.apps.filter((app) => UserGroupUtils.sessionHasReadAccessForApp(session, app.id));
    project.agents = project.agents.filter((agent) => UserGroupUtils.sessionHasReadAccessForProjectWorkload(session, agent.id));
  }

  return <SidebarCient agentsAvailable={agentsAvailable} newVersionInfo={newVersionInfo} projects={relevantProjectsForUser} session={session} />
}
