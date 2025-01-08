'use client'

import { Button } from "@/components/ui/button";

import Link from "next/link";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit2, Eye, MoreHorizontal, Trash } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { Project } from "@prisma/client";
import { deleteProject } from "./actions";
import { useBreadcrumbs, useConfirmDialog } from "@/frontend/states/zustand.states";
import { useEffect } from "react";
import { EditProjectDialog } from "./edit-project-dialog";



export default function ProjectsTable({ data }: { data: Project[] }) {

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

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['name', 'Name', true],
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
                                        <Eye /> <span>Show Apps of Project</span>
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuSeparator />
                                <EditProjectDialog existingItem={item}>
                                    <DropdownMenuItem>
                                        <Edit2 /> <span>Edit Project Name</span>
                                    </DropdownMenuItem>
                                </EditProjectDialog>
                                <DropdownMenuItem className="text-red-500" onClick={() => asyncDeleteProject(item.id)}>
                                    <Trash /> <span >Delete Project</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </>}
        />
    </>
}