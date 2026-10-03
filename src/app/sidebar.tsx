import projectService from "@/server/services/project.service"
import { getUserSession } from "@/server/utils/action-wrapper.utils"
import { SidebarCient } from "./sidebar-client"
import { UserGroupUtils } from "@/shared/utils/role.utils";
import quickStackUpdateService from "@/server/services/qs-update.service";
import agentSandboxAddonService from "@/server/services/addons/agent-sandbox-addon.service";
import paramService, { ParamService } from "@/server/services/param.service";

export async function AppSidebar() {

  const session = await getUserSession();

  if (!session) {
    return <></>
  }

  const projects = await projectService.getAllForNavigation();
  const newVersionInfo = await quickStackUpdateService.getNewVersionInfo();
  const agentSandboxStatus = await agentSandboxAddonService.getStatus();
  const agentsAvailable = agentSandboxStatus.status === 'ready';
  const canaryEnabled = (await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL)) ?? false;
  const relevantProjectsForUser = projects.filter((project) =>
    UserGroupUtils.sessionHasReadAccessToProject(session, project.id));
  for (const project of relevantProjectsForUser) {
    project.apps = project.apps.filter((app) => UserGroupUtils.sessionHasReadAccessForApp(session, app.id));
    project.agents = project.agents.filter((agent) => UserGroupUtils.sessionHasReadAccessForProjectWorkload(session, agent.id));
  }

  return <SidebarCient agentsAvailable={agentsAvailable} canaryEnabled={canaryEnabled} newVersionInfo={newVersionInfo} projects={relevantProjectsForUser} session={session} />
}
