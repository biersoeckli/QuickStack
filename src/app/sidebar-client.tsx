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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuAction,
  useSidebar
} from "@/components/ui/sidebar"
import { BookOpen, Boxes, ChartNoAxesCombined, ChevronDown, ChevronRight, ChevronUp, Dot, FolderClosed, Info, Plus, Server, Settings, Settings2, User } from "lucide-react"
import Link from "next/link"
import { EditProjectDialog } from "./projects/edit-project-dialog"
import { SidebarLogoutButton } from "./sidebar-logout-button"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { App, Project } from "@prisma/client"
import { UserSession } from "@/shared/model/sim-session.model"


const settingsMenu = [
  {
    title: "Profile",
    url: "/settings/profile",
    icon: User,
  },
  {
    title: "QuickStack Settings",
    url: "/settings/server",
    icon: Settings,
  },
  {
    title: "S3 Targets",
    url: "/settings/s3-targets",
    icon: Settings,
  },
  {
    title: "Cluster",
    url: "/settings/cluster",
    icon: Server,
  },
]

export function SidebarCient({
  projects,
  session
}: {
  projects: (Project & { apps: App[] })[];
  session: UserSession;
}) {

  const {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Boxes className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight my-4">
                    <span className="truncate font-semibold">QuickStack</span>
                    <span className="truncate text-xs">Admin Panel</span>
                  </div>
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                <Link href="https://quickstack.dev" target="_blank">
                  <DropdownMenuItem>
                    <Info />
                    <span>QuickStack Website</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="https://docs.quickstack.dev" target="_blank">
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
                <SidebarMenuButton asChild tooltip={{
                  children: 'All Projects',
                  hidden: open,
                }}>
                  <Link href="/">
                    <FolderClosed />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
                <EditProjectDialog>
                  <SidebarMenuAction>
                    <Plus />
                  </SidebarMenuAction>
                </EditProjectDialog>
                <SidebarMenu>
                  {projects.map((item) => (
                    <DropdownMenu key={item.id}>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip={{
                          children: `Project: ${item.name}`,
                          hidden: open,
                        }}>
                          <Link href={`/project?projectId=${item.id}`}>
                            <Dot />  <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.apps.length ? (<>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction className="">
                              <ChevronRight />
                              <span className="sr-only">Toggle</span>
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent
                            side={isMobile ? "bottom" : "right"}
                            align={isMobile ? "end" : "start"}
                            className="min-w-56 rounded-lg"
                          >
                            {item.apps.map((app) => (
                              <DropdownMenuItem asChild key={app.name}>
                                <a href={`/project/app/${app.id}`}>{app.name}</a>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </>) : null}
                      </SidebarMenuItem>
                    </DropdownMenu>
                  ))}
                </SidebarMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={{
                  children: 'Monitoring',
                  hidden: open,
                }}>
                  <Link href="/monitoring">
                    <ChartNoAxesCombined />
                    <span>Monitoring</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={{
                  children: 'Settings',
                  hidden: open,
                }}>
                  <Link href="/settings/profile">
                    <Settings2 />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {settingsMenu.map((item) => (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link href={item.url}>

                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{session.email.substring(0, 1) || 'Q'}</AvatarFallback>
                  </Avatar>
                  {session.email}
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <Link href="/settings/profile">
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
  )
}
