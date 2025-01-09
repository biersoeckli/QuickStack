'use client';

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { Breadcrumb, useBreadcrumbs } from "@/frontend/states/zustand.states";

export default function BreadcrumbSetter({ items }: { items: Breadcrumb[] }) {
    const { setBreadcrumbs } = useBreadcrumbs();
    useEffect(() => {
        setBreadcrumbs(items)
        return () => setBreadcrumbs([]);
    }, [items]);
    return <></>;
}