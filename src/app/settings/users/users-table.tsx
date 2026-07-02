'use client';

import { Button } from "@/components/ui/button";
import { ChevronDown, EditIcon, Plus, Trash2, TrashIcon, UserPlus } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import React from "react";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { UserExtended } from "@/shared/model/user-extended.model";
import UserEditOverlay from "./user-edit-overlay";
import { deleteUser } from "./actions";
import { UserGroupExtended, UserSession } from "@/shared/model/sim-session.model";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import UsersBulkRoleAssignment from "./users-table-bulk-role-assignment";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";

export default function UsersTable({ users, userGroups, session }: {
    users: UserExtended[];
    userGroups: UserGroupExtended[];
    session: UserSession;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();
    const [selectedUsers, setSelectedUsers] = React.useState<UserExtended[]>([]);
    const [isRoleDialogOpen, setIsRoleDialogOpen] = React.useState(false);

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

    const handleBulkDelete = async () => {
        // Filter out admin users from selected users
        const deletableUsers = selectedUsers.filter(user => session.email !== user.email);

        if (deletableUsers.length === 0) {
            toast.error("No deletable users selected (admins cannot be deleted)");
            return;
        }

        const confirm = await openDialog({
            title: "Delete Selected Users",
            description: `Do you really want to delete ${deletableUsers.length} user(s)?`,
            okButton: "Delete",
        });

        if (confirm) {
            try {
                // Delete users one by one
                for (const user of deletableUsers) {
                    await Actions.run(() => deleteUser(user.id));
                }
                toast.success(`Successfully deleted ${deletableUsers.length} user(s)`);
            } catch (error) {
                toast.error("Error deleting users");
                console.error(error);
            }
        }
    };

    return <>
        <SimpleDataTable columns={[
            ['id', 'ID', false],
            ['email', 'Mail', true],
            ['userGroup.name', 'Group', true],
            ["createdAt", "Created At", true, (item) => formatDateTime(item.createdAt)],
            ["updatedAt", "Updated At", false, (item) => formatDateTime(item.updatedAt)],
        ]}
            data={users}
            showSelectCheckbox={true}
            onRowSelectionUpdate={setSelectedUsers}
            columnFilters={userGroups.map((userGroup) => ({
                accessorKey: 'role.name',
                filterLabel: userGroup.name,
                filterFunction: (item: UserExtended) => item.userGroupId === userGroup.id,
            }))}
            actionCol={(item) =>
                <>
                    <div className="flex">
                        <div className="flex-1"></div>
                        {session.email !== item.email && <><UserEditOverlay user={item} userGroups={userGroups}>
                            <Button variant="ghost"><EditIcon /></Button>
                        </UserEditOverlay>
                            <Button variant="ghost" onClick={() => asyncDeleteItem(item.id)}>
                                <TrashIcon />
                            </Button>
                        </>}
                    </div>
                </>}
        />
        <div className="flex gap-4">
            <UserEditOverlay userGroups={userGroups}>
                <Button variant="secondary"><Plus /> Create User</Button>
            </UserEditOverlay>
            {selectedUsers.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline"> Actions <ChevronDown /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setIsRoleDialogOpen(true)}>
                            <UserPlus />   Assign Group
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBulkDelete}>
                            <Trash2 /> Delete Selected
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>

        <UsersBulkRoleAssignment
            isOpen={isRoleDialogOpen}
            onOpenChange={setIsRoleDialogOpen}
            selectedUsers={selectedUsers}
            userGroups={userGroups}
        />
    </>;
}