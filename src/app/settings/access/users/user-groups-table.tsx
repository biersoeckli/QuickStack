'use client';

import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import React from "react";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { deleteRole } from "./actions";
import { adminRoleName } from "@/shared/model/role-extended.model.ts";
import RoleEditOverlay from "./user-group-edit-overlay";
import { ProjectExtendedModel } from "@/shared/model/project-extended.model";
import { UserGroupExtended } from "@/shared/model/sim-session.model";

export default function UserGroupsTable({ userGroups, projects }: {
    userGroups: UserGroupExtended[];
    projects: ProjectExtendedModel[];
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteItem = async (id: string) => {
        const confirm = await openDialog({
            title: "Delete Group",
            description: "Do you really want to delete this group? Users with this group will be assigned to no role afterwards. They will not be able to use QuickStack until you reassign a new group to them.",
            okButton: "Delete",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteRole(id), 'Deleting Group...', 'Group deleted successfully');
        }
    };

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['name', 'Name', true],
            ["createdAt", "Created At", true, (item) => formatDateTime((item as any).createdAt)],
            ["updatedAt", "Updated At", false, (item) => formatDateTime((item as any).updatedAt)],
        ]}
            data={userGroups}
            actionCol={(item) =>
                <>
                    <div className="flex">
                        {item.name !== adminRoleName && <>
                            <div className="flex-1"></div>
                            <RoleEditOverlay projects={projects} userGroup={item} >
                                <Button variant="ghost"><EditIcon /></Button>
                            </RoleEditOverlay>
                            <Button variant="ghost" onClick={() => asyncDeleteItem(item.id)}>
                                <TrashIcon />
                            </Button>
                        </>}
                    </div>
                </>}
        />
        <RoleEditOverlay projects={projects} >
            <Button><Plus /> Create Group</Button>
        </RoleEditOverlay>
    </>;
}