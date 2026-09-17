'use client'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuAction,
  useSidebar
} from "@/components/ui/sidebar"
import { BookOpen, ChartNoAxesCombined, ChevronDown, ChevronRight, ChevronUp, Dot, FolderClosed, Hammer, History, Info, Plus, Settings2, User } from "lucide-react"
import Link from "next/link"
import { EditProjectDialog } from "./projects/edit-project-dialog"
import { SidebarLogoutButton } from "./sidebar-logout-button"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { ProjectNavigationModel } from "@/shared/model/project-extended.model"
import { UserSession } from "@/shared/model/sim-session.model"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import QuickStackLogo from "@/components/custom/quickstack-logo"
import { UserGroupUtils } from "@/shared/utils/role.utils"
import { QuickStackReleaseInfo } from "@/server/adapter/qs-versioninfo.adapter"
import { developerSettingsNavigation, serverSettingsHref, serverSettingsNavigation, settingsNavigation } from "@/shared/utils/settings-navigation"

export function SidebarCient({
  projects,
  session,
  newVersionInfo,
  agentsAvailable
}: {
  projects: ProjectNavigationModel[];
  session: UserSession;
  newVersionInfo?: QuickStackReleaseInfo;
  agentsAvailable: boolean;
}) {

  const path = usePathname();

  const [currentlySelectedProjectId, setCurrentlySelectedProjectId] = useState<string | null>(null);
  const [currentlySelectedAppId, setCurrentlySelectedAppId] = useState<string | null>(null);
  const [currentlySelectedAgentId, setCurrentlySelectedAgentId] = useState<string | null>(null);

  const isAdmin = UserGroupUtils.isAdmin(session)
  const visibleSettingsGroups = settingsNavigation.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      (!item.adminOnly || isAdmin) && (item.href !== "/settings/integrations/llm-gateways" || agentsAvailable)
    ),
  })).filter((group) => group.items.length > 0)
  const showSettingsNavigation = path.startsWith("/settings")

  useEffect(() => {
    if (path.startsWith('/project/agent/')) {
      const agentId = path.split('/')[3];
      const project = projects.find(p => p.agents?.some(a => a.id === agentId));
      setCurrentlySelectedProjectId(project?.id || null);
      setCurrentlySelectedAgentId(agentId);
      setCurrentlySelectedAppId(null);
    } else if (path.startsWith('/project/app/')) {
      const appId = path.split('/')[3];
      const project = projects.find(p => p.apps.some(a => a.id === appId));
      setCurrentlySelectedProjectId(project?.id || null);
      setCurrentlySelectedAppId(appId);
      setCurrentlySelectedAgentId(null);

    } else if (path.startsWith("/project")) {
      const projectId = path.split('/')[2];
      setCurrentlySelectedProjectId(projectId);
      setCurrentlySelectedAppId(null);
      setCurrentlySelectedAgentId(null);

    } else {
      setCurrentlySelectedProjectId(null);
      setCurrentlySelectedAppId(null);
      setCurrentlySelectedAgentId(null);

    }
  }, [path, projects]);

  const {
    open,
    isMobile,
  } = useSidebar()

  return (
    <>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg"
                  className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-sm bg-qs-500 text-sidebar-primary-foreground">
                    <QuickStackLogo className="size-5" color="light-all" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight my-4 pl-1">
                    <span className="truncate font-semibold">QuickStack</span>
                    <span className="truncate text-xs">Admin Panel</span>
                  </div>
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>} />
              <DropdownMenuContent className="w-(--anchor-width)">
                <Link href="https://quickstack.dev" target="_blank">
                  <DropdownMenuItem>
                    <Info />
                    <span>QuickStack Website</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="https://quickstack.dev/docs" target="_blank">
                  <DropdownMenuItem>
                    <BookOpen />
                    <span>QuickStack Docs</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={{
                  children: 'All Projects',
                  hidden: open,
                }} isActive={path === '/'} render={<Link href="/">
                    <FolderClosed />
                    <span>Projects</span>
                  </Link>} />
                {UserGroupUtils.isAdmin(session) && <EditProjectDialog agentsAvailable={agentsAvailable}>
                  <SidebarMenuAction>
                    <Plus />
                  </SidebarMenuAction>
                </EditProjectDialog>}
                <SidebarMenu>
                  {projects.map((item) => {
                    const isAgentProject = item.projectType === 'AGENT';
                    const workloads = isAgentProject ? (item.agents || []) : item.apps;
                    const workloadPath = isAgentProject ? '/project/agent/' : '/project/app/';
                    const currentlySelectedWorkloadId = isAgentProject ? currentlySelectedAgentId : currentlySelectedAppId;

                    return (
                      <DropdownMenu key={item.id}>
                        <SidebarMenuItem>
                          <SidebarMenuButton tooltip={{
                            children: `Project: ${item.name}`,
                            hidden: open,
                          }} isActive={currentlySelectedProjectId === item.id} render={<Link href={`/project/${item.id}`}>
                              <Dot />  <span>{item.name}</span>
                            </Link>} />
                          {workloads.length ? (<>
                            <DropdownMenuTrigger render={<SidebarMenuAction className="">
                                <ChevronRight />
                                <span className="sr-only">Toggle</span>
                              </SidebarMenuAction>} />

                            <DropdownMenuContent
                              side={isMobile ? "bottom" : "right"}
                              align={isMobile ? "end" : "start"}
                              className="min-w-56 rounded-lg"
                            >
                              {workloads.map((workload) => (
                                <DropdownMenuItem key={workload.name} className={currentlySelectedWorkloadId === workload.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''} render={<a href={`${workloadPath}${workload.id}`}>{workload.name}</a>} />
                              ))}
                            </DropdownMenuContent>
                          </>) : null}
                        </SidebarMenuItem>
                      </DropdownMenu>
                    )
                  })}
                </SidebarMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={{
                  children: 'Builds',
                  hidden: open,
                }} isActive={path.startsWith('/builds')} render={<Link href="/builds">
                    <Hammer />
                    <span>Builds</span>
                  </Link>} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={{
                  children: 'Monitoring',
                  hidden: open,
                }} isActive={path.startsWith('/monitoring')} render={<Link href="/monitoring">
                    <ChartNoAxesCombined />
                    <span>Monitoring</span>
                  </Link>} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {UserGroupUtils.sessionHasAccessToBackups(session) && <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={{
                  children: 'Backups',
                  hidden: open,
                }} isActive={path.startsWith('/backups')} render={<Link href="/backups">
                    <History />
                    <span>Backups</span>
                  </Link>} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}


        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={{
                  children: 'Settings',
                  hidden: open,
                }} isActive={showSettingsNavigation} render={<Link href="/settings/account/profile">
                    <Settings2 />
                    <span>Settings</span>
                    {newVersionInfo && <span className="ml-auto size-2 rounded-full bg-orange-500 animate-pulse" />}
                  </Link>} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton
                  size="lg"
                  className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{session.email.substring(0, 1)?.toUpperCase() || 'Q'}</AvatarFallback>
                  </Avatar>
                  {session.email}
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>} />
              <DropdownMenuContent
                side="top"
                className="w-(--anchor-width)"
              >
                <Link href="/settings/account/profile">
                  <DropdownMenuItem>
                    <User />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <SidebarLogoutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    {showSettingsNavigation && <aside className="sticky top-0 hidden h-svh w-64 shrink-0 self-start flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-4 text-sm font-semibold">
        <Settings2 className="size-4" />
        Settings
      </div>
      <SidebarContent className="gap-0 py-2">
        {visibleSettingsGroups.map((group) => <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon
                return <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton isActive={path === item.href} render={<Link href={item.href}>
                    <Icon />
                    <span>{item.title}</span>
                  </Link>} />
                </SidebarMenuItem>
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>)}

        {isAdmin && <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {serverSettingsNavigation.map((item) => {
                const Icon = item.icon
                const href = serverSettingsHref(item.tab)
                return <SidebarMenuItem key={item.tab}>
                  <SidebarMenuButton isActive={path === href} render={<Link href={href}>
                    <Icon />
                    <span>{item.title}</span>
                    {item.tab === "updates" && newVersionInfo && <span className="ml-auto size-2 rounded-full bg-orange-500 animate-pulse" />}
                  </Link>} />
                </SidebarMenuItem>
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}
        {isAdmin && <SidebarGroup>
          <SidebarGroupLabel>Developer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {developerSettingsNavigation.map((item) => {
                const Icon = item.icon
                return <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton isActive={path === item.href} render={<Link href={item.href}>
                    <Icon />
                    <span>{item.title}</span>
                  </Link>} />
                </SidebarMenuItem>
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}
      </SidebarContent>
    </aside>}
    </>
  )
}
