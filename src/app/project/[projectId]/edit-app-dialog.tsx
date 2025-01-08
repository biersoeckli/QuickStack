'use client'

import { InputDialog } from "@/components/custom/input-dialog"
import { Button } from "@/components/ui/button"
import { Toast } from "@/frontend/utils/toast.utils";
import { createApp } from "./actions";
import { redirect } from "next/navigation";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { App } from "@prisma/client";
import { useInputDialog } from "@/frontend/states/zustand.states";

export function EditAppDialog({
    children,
    projectId,
    existingItem
}: {
    children?: React.ReactNode,
    projectId: string;
    existingItem?: App;
}) {

    const router = useRouter();
    const { openInputDialog } = useInputDialog();

    const createAppFunc = async () => {
        const name = await openInputDialog({
            title: "Create App",
            description: "Name your new App.",
            fieldName: "Name",
            inputValue: existingItem?.name ?? ''
        })
        if (!name) { return; }
        const result = await Toast.fromAction(() => createApp(name, projectId, existingItem?.id));
        if (result.status === "success" && !existingItem) {
            router.push(`/project/app/${result.data.id}`);
        }
    };

    return <div onClick={() => createAppFunc()}>{children}</div>
}