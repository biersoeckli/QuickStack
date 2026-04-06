'use client'

import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { useEffect, useState } from "react";
import { deleteBuildAction, getAllBuildsAction } from "./actions";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { GlobalBuildJobModel } from "@/shared/model/global-build-job.model";
import BuildStatusBadge from "./build-status-badge";
import { BuildLogsDialog } from "@/app/project/app/[appId]/overview/build-logs-overlay";
import ShortCommitHash from "@/components/custom/short-commit-hash";
import { UserSession } from "@/shared/model/sim-session.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

export default function BuildsTable({
    initialBuilds,
    session,
}: {
    initialBuilds: GlobalBuildJobModel[];
    session: UserSession;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const [builds, setBuilds] = useState<GlobalBuildJobModel[]>(initialBuilds);
    const [selectedBuildForLogs, setSelectedBuildForLogs] = useState<GlobalBuildJobModel | undefined>(undefined);

    const fetchBuilds = async () => {
        const response = await getAllBuildsAction();
        if (response.status === 'success' && response.data) {
            setBuilds(response.data);
        }
    };

    useEffect(() => {
        const intervalId = setInterval(fetchBuilds, 10000);
        return () => clearInterval(intervalId);
    }, []);

    const handleDeleteBuild = async (buildName: string) => {
        const confirm = await openConfirmDialog({
            title: "Stop Build",
            description: "The build will be stopped and removed. Are you sure you want to stop this build?",
            okButton: "Stop & Remove Build",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteBuildAction(buildName));
            await fetchBuilds();
        }
    };

    return (
        <>
            {!builds ? (
                <FullLoadingSpinner />
            ) : (
                <SimpleDataTable
                    columns={[
                         ['status', 'Status', true, (item) => (
                            <BuildStatusBadge>{item.status}</BuildStatusBadge>
                        )],
                         ['projectName', 'Project', true, (item) => (
                            <span className="flex items-center gap-1 text-muted-foreground text-sm">
                                {item.projectName}
                                <Link href={`/project/${item.projectId}`} onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="h-3 w-3 hover:text-foreground" />
                                </Link>
                            </span>
                        )],
                        ['appName', 'App', true, (item) => (
                            <span className="flex items-center gap-1 font-medium">
                                {item.appName}
                                <Link href={`/project/app/${item.appId}`} onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </Link>
                            </span>
                        )],
                        ['name', 'Build Job', false],
                        ['startTime', 'Started At', true, (item) => formatDateTime(item.startTime)],
                        ['completionTime', 'Duration', true, (item) => {
                            const start = new Date(item.startTime).getTime();
                            const end = item.completionTime ? new Date(item.completionTime).getTime() : Date.now();
                            const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = totalSeconds % 60;
                            const label = minutes > 0
                                ? `${minutes}m ${seconds}s`
                                : `${seconds}s`;
                            return <span className="text-muted-foreground text-sm">{item.status === 'UNKNOWN' ? '—' : label}</span>;
                        }],
                        ['gitCommit', 'Git Commit', false, (item) => (
                            <ShortCommitHash>{item.gitCommit}</ShortCommitHash>
                        )],
                        ['gitCommitMessage', 'Commit Message', true, (item) => (
                            <span className="text-muted-foreground text-sm">{item.gitCommitMessage ?? ''}</span>
                        )],
                    ]}
                    data={builds}
                    actionCol={(item) => (
                        <div className="flex gap-4">
                            <div className="flex-1" />
                            {item.deploymentId && (
                                <Button variant="secondary" onClick={() => setSelectedBuildForLogs(item)}>
                                    Show Logs
                                </Button>
                            )}
                            {(item.status === 'RUNNING' || item.status === 'PENDING') && UserGroupUtils.sessionHasWriteAccessForApp(session, item.appId) && (
                                <Button variant="destructive" onClick={() => handleDeleteBuild(item.name)}>
                                    Stop Build
                                </Button>
                            )}
                        </div>
                    )}
                />
            )}
            <BuildLogsDialog
                deploymentInfo={selectedBuildForLogs ? {
                    deploymentId: selectedBuildForLogs.deploymentId,
                    createdAt: selectedBuildForLogs.startTime,
                    status: 'BUILDING',
                } : undefined}
                onClose={() => setSelectedBuildForLogs(undefined)}
            />
        </>
    );
}
