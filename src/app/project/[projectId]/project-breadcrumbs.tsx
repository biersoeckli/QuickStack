'use client';

import { useBreadcrumbs } from "@/frontend/states/zustand.states";
import { useEffect } from "react";

export default function ProjectBreadcrumbs({ project }: { project: { name: string } }) {
    const { setBreadcrumbs } = useBreadcrumbs();
    useEffect(() => setBreadcrumbs([
        { name: "Projects", url: "/" },
        { name: project.name }
    ]), [project.name, setBreadcrumbs]);
    return <></>;
}