'use client';

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/frontend/states/zustand.states";
import { useEffect } from "react";
import { AppExtendedModel } from "@/shared/model/app-extended.model";

export default function AppBreadcrumbs({ app }: { app: AppExtendedModel }) {
    const { setBreadcrumbs } = useBreadcrumbs();
    useEffect(() => setBreadcrumbs([
        { name: "Projects", url: "/" },
        { name: app.project.name, url: "/project/" + app.projectId },
        { name: app.name },
    ]), []);
    return <></>;
}