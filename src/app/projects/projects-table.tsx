'use client'

import { Button } from "@/components/ui/button";

import Link from "next/link";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit2, Eye, Folder, FolderClosed, MoreHorizontal, Plus, Trash } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { Project } from "@prisma/client";
import { deleteProject } from "./actions";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { EditProjectDialog } from "./edit-project-dialog";
import { UserSession } from "@/shared/model/sim-session.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import ProjectStatusIndicator from "@/components/custom/project-status-indicator";
import { ProjectExtendedModel } from "@/shared/model/project-extended.model";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";


export default function ProjectsTable({ data, session, agentsAvailable }: {
    data: ProjectExtendedModel[];
    session: UserSession;
    agentsAvailable: boolean;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteProject = async (domainId: string) => {
        const confirm = await openDialog({
            title: "Delete Project",
            description: "Are you sure you want to delete this project? All data (apps, deployments, volumes, domains) will be lost and this action cannot be undone. Running apps will be stopped and removed.",
            okButton: "Delete Project"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteProject(domainId));
        }
    };

    const isAdmin = UserGroupUtils.isAdmin(session);

    if (data.length === 0 && !isAdmin) {
        return (
            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <FolderClosed />
                    </EmptyMedia>
                    <EmptyTitle>No Projects</EmptyTitle>
                    <EmptyDescription>
                        There are currently no projects available. Please contact your administrator to create a project for you.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    if (data.length === 0) {
        return (
            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <FolderClosed />
                    </EmptyMedia>
                    <EmptyTitle>No Projects yet</EmptyTitle>
                    <EmptyDescription>
                        Create your first Project to get started.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <EditProjectDialog agentsAvailable={agentsAvailable}>
                        <Button><Plus /> Create Project</Button>
                    </EditProjectDialog>
                </EmptyContent>
            </Empty>
        );
    }

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['name', 'Name', true, (item) => (
                <Link href={`/project/${item.id}`}
                    className="font-medium cursor-pointer hover:underline">
                    {item.name}
                </Link>
            )],
            ['projectType', 'Type', true, (item) => item.projectType === 'AGENT' ? 'Agent' : 'App'],
            ['status', 'Status', true, (item) => item.projectType === 'APP'
                ? <ProjectStatusIndicator projectId={item.id} />
                : <span className="text-muted-foreground">{item.agents.length === 0 ? 'No Agents' : item.agents.length + ' Agents'}</span>],
            ["createdAt", "Created At", true, (item) => formatDateTime(item.createdAt)],
            ["updatedAt", "Updated At", false, (item) => formatDateTime(item.updatedAt)],
        ]}
            data={data}
            onItemClickLink={(item) => `/project/${item.id}`}
            actionCol={(item) =>
                <>
                    <div className="flex">
                        <div className="flex-1"></div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <Link href={`/project/${item.id}`}>
                                    <DropdownMenuItem>
                                        <Eye /> <span>Show {item.projectType === 'AGENT' ? 'Agents' : 'Apps'} of Project</span>
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuSeparator />
                                {UserGroupUtils.isAdmin(session) && <>
                                    <EditProjectDialog agentsAvailable={agentsAvailable} existingItem={item}>
                                        <DropdownMenuItem>
                                            <Edit2 /> <span>Edit Project Name</span>
                                        </DropdownMenuItem>
                                    </EditProjectDialog>
                                    <DropdownMenuItem className="text-red-500" onClick={() => asyncDeleteProject(item.id)}>
                                        <Trash /> <span >Delete Project</span>
                                    </DropdownMenuItem>
                                </>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </>}
        />
    </>
}
