'use client';

import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import React from "react";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { deleteRole } from "./actions";
import { adminRoleName, RoleExtended, RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import RoleEditOverlay from "./role-edit-overlay";
import { AppWithProjectModel } from "@/shared/model/app-extended.model";

export default function RolesTable({ roles, apps }: {
    roles: RoleExtended[];
    apps: AppWithProjectModel[];
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteItem = async (id: string) => {
        const confirm = await openDialog({
            title: "Delete Role",
            description: "Do you really want to delete this role? Users with this role will be assigned to no role afterwards. They will not be able to use QuickStack until you reassign a new role to them.",
            okButton: "Delete",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteRole(id), 'Deleting Role...', 'Role deleted successfully');
        }
    };

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['name', 'Name', true],
            ['roleReadPermissions', 'Read Permissions', true, (item) => item.roleAppPermissions.filter(x => x.permission === RolePermissionEnum.READ).map(p => p.app.name).join(', ')],
            ['roleWritePermissions', 'Write Permissions', true, (item) => item.roleAppPermissions.filter(x => x.permission === RolePermissionEnum.READWRITE).map(p => p.app.name).join(', ')],
            ["createdAt", "Created At", true, (item) => formatDateTime(item.createdAt)],
            ["updatedAt", "Updated At", false, (item) => formatDateTime(item.updatedAt)],
        ]}
            data={roles}
            actionCol={(item) =>
                <>
                    <div className="flex">
                        {item.name !== adminRoleName && <>
                            <div className="flex-1"></div>
                            <RoleEditOverlay apps={apps} role={item} >
                                <Button variant="ghost"><EditIcon /></Button>
                            </RoleEditOverlay>
                            <Button variant="ghost" onClick={() => asyncDeleteItem(item.id)}>
                                <TrashIcon />
                            </Button>
                        </>}
                    </div>
                </>}
        />
        <RoleEditOverlay apps={apps} >
            <Button variant="secondary"><Plus /> Create Role</Button>
        </RoleEditOverlay>
    </>;
}