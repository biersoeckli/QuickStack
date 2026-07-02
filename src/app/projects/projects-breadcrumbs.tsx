'use client';

import { useBreadcrumbs } from "@/frontend/states/zustand.states";
import { useEffect } from "react";

export default function ProjectsBreadcrumbs() {
    const { setBreadcrumbs } = useBreadcrumbs();
    useEffect(() => setBreadcrumbs([
        { name: "Projects", url: "/" }
    ]), [setBreadcrumbs]);
    return <></>;
}