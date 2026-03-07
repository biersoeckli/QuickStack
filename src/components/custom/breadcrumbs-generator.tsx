'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
    SidebarTrigger
} from "@/components/ui/sidebar"
import { AppleIcon, Calendar, ChartNoAxesCombined, ChevronDown, ChevronUp, FolderClosed, Home, Inbox, Plus, Search, Server, Settings, Settings2, User, User2 } from "lucide-react"
import Link from "next/link"
import { EditProjectDialog } from "../../app/projects/edit-project-dialog"
import projectService from "@/server/services/project.service"
import { getAuthUserSession } from "@/server/utils/action-wrapper.utils"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useBreadcrumbs } from "@/frontend/states/zustand.states"
import { Separator } from "../ui/separator"

export function BreadcrumbsGenerator() {

    const { breadcrumbs } = useBreadcrumbs();

    return (<>
        <div className="-ml-1 flex gap-4 items-center fixed w-full top-0 bg-white pt-6 pb-4 z-50">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 h-4" />
            {breadcrumbs && <Breadcrumb>
                <BreadcrumbList>
                    {breadcrumbs.map((x, index) => (<>
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem key={x.name}>
                            {x.dropdownItems ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="flex items-center gap-1 transition-colors hover:text-foreground">
                                        {x.name}
                                        <ChevronDown size={14} />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        {x.dropdownItems.map((item) => (
                                            <DropdownMenuItem key={item.url} disabled={item.active} asChild={!item.active}>
                                                {item.active ? <span>{item.name}</span> : <Link href={item.url}>{item.name}</Link>}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <BreadcrumbLink href={x.url ?? undefined}>{x.name}</BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </>))}
                </BreadcrumbList>
            </Breadcrumb>}
        </div>
        <div className="h-[32px]">
            <div></div>
        </div>
    </>
    )
}
