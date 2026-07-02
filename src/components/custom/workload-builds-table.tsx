'use client';

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import ShortCommitHash from "@/components/custom/short-commit-hash";
import BuildStatusBadge from "@/app/builds/build-status-badge";
import { BuildLogsDialog } from "@/app/project/app/[appId]/overview/build-logs-overlay";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { BuildJobModel } from "@/shared/model/build-job";
import { DeploymentInfoModel, DeploymentStatus } from "@/shared/model/deployment-info.model";
import { GlobalBuildJobModel } from "@/shared/model/global-build-job.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import { deleteWorkloadBuildAction, getWorkloadBuildsAction } from "@/app/project/actions";

type WorkloadBuildRow = BuildJobModel & Partial<Pick<GlobalBuildJobModel, 'projectId' | 'projectName' | 'workloadName' | 'completionTime'>>;

export default function WorkloadBuildsTable({
    initialBuilds,
    workloadId,
    workloadType,
    card = false,
    title = "Builds",
    description = "Overview of build jobs.",
    hideSearchBar = false,
}: {
    initialBuilds?: WorkloadBuildRow[];
    workloadId?: string;
    workloadType?: WorkloadType;
    card?: boolean;
    title?: string;
    description?: string;
    hideSearchBar?: boolean;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const [builds, setBuilds] = useState<WorkloadBuildRow[] | undefined>(initialBuilds);
    const [selectedBuildForLogs, setSelectedBuildForLogs] = useState<DeploymentInfoModel | undefined>(undefined);
    const isGlobalView = !workloadId;

    const fetchBuilds = async () => {
        const response = await getWorkloadBuildsAction({ workloadId, workloadType });
        if (response.status === 'success') {
            setBuilds((response.data ?? []) as WorkloadBuildRow[]);
        }
    };

    useEffect(() => {
        if (!initialBuilds) {
            fetchBuilds();
        }
        const intervalId = setInterval(fetchBuilds, 10000);
        return () => clearInterval(intervalId);
    }, [workloadId, workloadType]);

    const handleDeleteBuild = async (buildName: string) => {
        const confirm = await openConfirmDialog({
            title: "Stop Build",
            description: "The build will be stopped and removed. Are you sure you want to stop this build?",
            okButton: "Stop & Remove Build",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteWorkloadBuildAction(buildName, { workloadId, workloadType }));
            await fetchBuilds();
        }
    };

    const columns: ([string, string, boolean] | [string, string, boolean, (item: WorkloadBuildRow) => ReactNode])[] = [
        ['status', 'Status', true, (item) => <BuildStatusBadge>{item.status}</BuildStatusBadge>],
    ];

    if (isGlobalView) {
        columns.push(
            ['projectName', 'Project', true, (item) => (
                <span className="flex items-center gap-1 text-muted-foreground text-sm">
                    {item.projectName}
                    {item.projectId && (
                        <Link href={`/project/${item.projectId}`} onClick={(e) => e.stopPropagation()}>
                            <ExternalLink className="h-3 w-3 hover:text-foreground" />
                        </Link>
                    )}
                </span>
            )],
            ['workloadName', 'Workload', true, (item) => (
                <span className="flex items-center gap-1 font-medium">
                    {item.workloadName}
                    <span className="text-xs text-muted-foreground uppercase">{item.workloadType}</span>
                    <Link href={`/project/${item.workloadType}/${item.workloadId}`} onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </Link>
                </span>
            )],
        );
    }

    columns.push(
        ['name', 'Build Job', false],
        ['buildMethod', 'Build Method', true, (item) => (
            <span className="text-muted-foreground text-sm">
                {item.buildMethod === 'DOCKERFILE' ? 'Dockerfile' : item.buildMethod === 'RAILPACK' ? 'Railpack' : '-'}
            </span>
        )],
        ['startTime', 'Started At', true, (item) => item.startTime ? formatDateTime(item.startTime) : '-'],
    );

    if (isGlobalView) {
        columns.push(['completionTime', 'Duration', true, (item) => {
            const start = new Date(item.startTime).getTime();
            const end = item.completionTime ? new Date(item.completionTime).getTime() : Date.now();
            const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const label = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            return <span className="text-muted-foreground text-sm">{item.status === 'UNKNOWN' ? '-' : label}</span>;
        }]);
    }

    columns.push(
        ['gitCommit', 'Git Commit', true, (item) => <ShortCommitHash>{item.gitCommit}</ShortCommitHash>],
        ['gitCommitMessage', 'Commit Message', true, (item) => <span className="text-muted-foreground text-sm">{item.gitCommitMessage ?? ''}</span>],
    );

    const table = !builds ? (
        <FullLoadingSpinner />
    ) : (
        <SimpleDataTable
            columns={columns}
            data={builds}
            hideSearchBar={hideSearchBar}
            actionCol={(item) => (
                <div className="flex gap-4">
                    <div className="flex-1" />
                    {item.deploymentId && (
                        <Button variant="secondary" onClick={() => setSelectedBuildForLogs(toDeploymentInfo(item))}>
                            Show Logs
                        </Button>
                    )}
                    {item.name && (item.status === 'RUNNING' || item.status === 'PENDING') && (
                        <Button variant="destructive" onClick={() => handleDeleteBuild(item.name)}>
                            Stop Build
                        </Button>
                    )}
                </div>
            )}
        />
    );

    return (
        <>
            {card ? (
                <Card>
                    <CardHeader>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {table}
                    </CardContent>
                </Card>
            ) : table}
            <BuildLogsDialog deploymentInfo={selectedBuildForLogs} onClose={() => setSelectedBuildForLogs(undefined)} />
        </>
    );
}

function toDeploymentInfo(build: WorkloadBuildRow): DeploymentInfoModel {
    return {
        buildJobName: build.name,
        createdAt: build.startTime ?? new Date(),
        status: buildStatusToDeploymentStatus(build.status),
        gitCommit: build.gitCommit,
        gitCommitMessage: build.gitCommitMessage,
        deploymentId: build.deploymentId,
        buildMethod: build.buildMethod,
    };
}

function buildStatusToDeploymentStatus(status: BuildJobModel['status']): DeploymentStatus {
    if (status === 'RUNNING' || status === 'PENDING') {
        return 'BUILDING';
    }
    if (status === 'SUCCEEDED') {
        return 'DEPLOYED';
    }
    if (status === 'FAILED') {
        return 'ERROR';
    }
    return 'UNKNOWN';
}
