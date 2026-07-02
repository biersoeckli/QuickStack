'use client';

import { useBreadcrumbs } from "@/frontend/states/zustand.states";
import { useEffect } from "react";
import { AppExtendedModel } from "@/shared/model/app-extended.model";

export default function AppBreadcrumbs({ app, apps, tabName }: { app: AppExtendedModel; apps: { id: string; name: string }[]; tabName?: string }) {
    const { setBreadcrumbs } = useBreadcrumbs();
    useEffect(() => setBreadcrumbs([
        { name: "Projects", url: "/" },
        { name: app.project.name, url: "/project/" + app.projectId },
        {
            name: app.name,
            dropdownItems: apps.map(a => ({
                name: a.name,
                url: `/project/app/${a.id}${tabName ? `?tabName=${tabName}` : ''}`,
                active: a.id === app.id,
            })),
        },
    ]), [app.id, app.name, app.project.name, app.projectId, apps, setBreadcrumbs, tabName]);
    return <></>;
}