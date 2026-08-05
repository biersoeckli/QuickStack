'use client';

import { useEffect } from "react";
import { Breadcrumb, useBreadcrumbs } from "@/frontend/states/zustand.states";

export default function BreadcrumbSetter({ items }: { items: Breadcrumb[] }) {
    const setBreadcrumbs = useBreadcrumbs((state) => state.setBreadcrumbs);
    useEffect(() => {
        setBreadcrumbs(items)
        return () => setBreadcrumbs([]);
    }, [items, setBreadcrumbs]);
    return <></>;
}
