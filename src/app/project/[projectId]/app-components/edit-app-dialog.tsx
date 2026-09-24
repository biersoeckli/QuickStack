'use client'

import { Toast } from "@/frontend/utils/toast.utils";
import { createApp } from "../actions";
import { useRouter } from "next/navigation";
import { cloneElement, type MouseEvent, type ReactElement } from "react";
import type { App } from "@prisma/client";
import { useInputDialog } from "@/frontend/states/zustand.states";

export function EditAppDialog({
    children,
    projectId,
    existingItem,
    openAppAfterCreate = true
}: {
    children?: ReactElement<{ onClick?: (event: MouseEvent) => void }>;
    projectId: string;
    existingItem?: Pick<App, 'id' | 'name'>;
    openAppAfterCreate?: boolean;
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
        if (result.status === "success" && !existingItem && openAppAfterCreate) {
            router.push(existingItem ? `/project/app/${result!.data!.id}` : `/project/app/${result!.data!.id}?tabName=general`);
        }
    };

    if (!children) return null;

    return cloneElement(children, {
        onClick: (event) => {
            children.props.onClick?.(event);
            void createAppFunc();
        },
    });
}
