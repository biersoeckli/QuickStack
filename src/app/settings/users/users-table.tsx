'use client';

import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { User } from "@prisma/client";
import React from "react";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { UserExtended } from "@/shared/model/user-extended.model";
import UserEditOverlay from "./user-edit-overlay";
import { deleteUser } from "./actions";
import { RoleExtended } from "@/shared/model/role-extended.model.ts";
import { UserSession } from "@/shared/model/sim-session.model";

export default function UsersTable({ users, roles, session }: {
    users: UserExtended[];
    roles: RoleExtended[];
    session: UserSession;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const asyncDeleteItem = async (id: string) => {
        const confirm = await openDialog({
            title: "Delete User",
            description: "Do you really want to delete this user?",
            okButton: "Delete",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteUser(id), 'Deleting User...', 'User deleted successfully');
        }
    };

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['email', 'Mail', true],
            ['role.name', 'Role', true],
            ["createdAt", "Created At", true, (item) => formatDateTime(item.createdAt)],
            ["updatedAt", "Updated At", false, (item) => formatDateTime(item.updatedAt)],
        ]}
            data={users}
            actionCol={(item) =>
                <>
                    <div className="flex">
                        <div className="flex-1"></div>
                        {session.email !== item.email && <><UserEditOverlay user={item} roles={roles}>
                            <Button variant="ghost"><EditIcon /></Button>
                        </UserEditOverlay>
                            <Button variant="ghost" onClick={() => asyncDeleteItem(item.id)}>
                                <TrashIcon />
                            </Button>
                        </>}
                    </div>
                </>}
        />
        <UserEditOverlay roles={roles}>
            <Button variant="secondary"><Plus /> Create User</Button>
        </UserEditOverlay>
    </>;
}