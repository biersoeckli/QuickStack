'use client';

import { useEffect } from "react";
import { Breadcrumb, useBreadcrumbs } from "@/frontend/states/zustand.states";

interface WorkloadBreadcrumbsProps {
    projectId: string;
    projectName: string;
    workloadId: string;
    workloadName: string;
    workloads: { id: string; name: string }[];
    workloadBasePath: string;
    queryParams?: Record<string, string | undefined>;
}

const buildWorkloadUrl = (
    workloadBasePath: string,
    workloadId: string,
    queryParams?: Record<string, string | undefined>,
) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(queryParams ?? {})) {
        if (value) {
            params.set(key, value);
        }
    }

    const query = params.toString();
    return `${workloadBasePath}/${workloadId}${query ? `?${query}` : ''}`;
};

export default function WorkloadBreadcrumbs({
    projectId,
    projectName,
    workloadId,
    workloadName,
    workloads,
    workloadBasePath,
    queryParams,
}: WorkloadBreadcrumbsProps) {
    const setBreadcrumbs = useBreadcrumbs((state) => state.setBreadcrumbs);

    useEffect(() => {
        const breadcrumbs: Breadcrumb[] = [
            { name: "Projects", url: "/" },
            { name: projectName, url: `/project/${projectId}` },
            {
                name: workloadName,
                dropdownItems: workloads.map((workload) => ({
                    name: workload.name,
                    url: buildWorkloadUrl(workloadBasePath, workload.id, queryParams),
                    active: workload.id === workloadId,
                })),
            },
        ];

        setBreadcrumbs(breadcrumbs);
    }, [projectId, projectName, queryParams, setBreadcrumbs, workloadBasePath, workloadId, workloadName, workloads]);

    return <></>;
}
