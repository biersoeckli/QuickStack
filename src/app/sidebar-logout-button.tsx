'use client'

import { signOut } from "next-auth/react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"


import { LogOut } from "lucide-react"
import { useConfirmDialog } from "@/frontend/states/zustand.states";

export function SidebarLogoutButton() {

    const { openConfirmDialog: openDialog } = useConfirmDialog();

    const signOutAsync = async () => {
        if (!await openDialog({
            title: "Sign out",
            description: "Are you sure you want to sign out?",
            okButton: "Sign out",
        })) {
            return;
        }
        await signOut({
            callbackUrl: undefined,
            redirect: false
        });
        window.open("/auth", "_self");
    }
    return (
        <DropdownMenuItem onClick={() => signOutAsync()}>
            <LogOut />
            <span>Sign out</span>
        </DropdownMenuItem>
    )
}
