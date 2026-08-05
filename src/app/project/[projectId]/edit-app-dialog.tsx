'use client'

import { Toast } from "@/frontend/utils/toast.utils";
import { createApp } from "./actions";
import { useRouter } from "next/navigation";
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
            router.push(existingItem ? `/project/app/${result!.data!.id}` : `/project/app/${result!.data!.id}?tabName=general`);
        }
    };

    return <div onClick={() => createAppFunc()}>{children}</div>
}