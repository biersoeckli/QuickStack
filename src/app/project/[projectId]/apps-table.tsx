'use client'

import { Button } from "@/components/ui/button";

import Link from "next/link";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit2, Eye, MoreHorizontal, Trash } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { App, Project } from "@prisma/client";
import { deleteApp } from "./actions";
import { useBreadcrumbs, useConfirmDialog } from "@/frontend/states/zustand.states";
import { useEffect } from "react";
import { EditAppDialog } from "./edit-app-dialog";
import { UserSession } from "@/shared/model/sim-session.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import PodStatusIndicator from "@/components/custom/pod-status-indicator";


export default function AppTable({
    app,
    projectId,
    session
}: {
    app: App[],
    projectId: string,
    session: UserSession
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['name', 'Name', true],
            ['sourceType', 'Source Type', false, (item) => item.sourceType === 'GIT' ? 'Git' : 'Container'],
            ['replicas', 'Replica Count', false],
            ['memoryLimit', 'Memory Limit', false],
            ['memoryReservation', 'Memory Reservation', false],
            ['cpuLimit', 'CPU Limit', false],
            ['cpuReservation', 'CPU Reservation', false],
            ["createdAt", "Created At", true, (item) => formatDateTime(item.createdAt)],
            ["updatedAt", "Updated At", false, (item) => formatDateTime(item.updatedAt)],
            ['status', 'Status', true, (item) => <PodStatusIndicator appId={item.id} />],
        ]}
            data={app}
            onItemClickLink={(item) => `/project/app/${item.id}`}
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
                                <Link href={`/project/app/${item.id}`}>
                                    <DropdownMenuItem>
                                        <Eye /> <span>Show App Details</span>
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuSeparator />
                                {UserGroupUtils.sessionCanCreateNewAppsForProject(session, projectId) &&
                                    <EditAppDialog projectId={projectId} existingItem={item}>
                                        <DropdownMenuItem>
                                            <Edit2 /> <span>Edit App Name</span>
                                        </DropdownMenuItem>
                                    </EditAppDialog>}
                                {UserGroupUtils.sessionCanDeleteAppsForProject(session, projectId) && <DropdownMenuItem className="text-red-500"
                                    onClick={() => openDialog({
                                        title: "Delete App",
                                        description: "Are you sure you want to delete this app? All data will be lost and this action cannot be undone.",
                                    }).then((result) => result ? Toast.fromAction(() => deleteApp(item.id)) : undefined)}>
                                    <Trash />  <span >Delete App</span>
                                </DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </>}
        />
    </>
}