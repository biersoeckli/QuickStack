'use client';

import { useCallback, useState } from 'react';
import {
    Boxes,
    EllipsisVertical,
    File,
    GitCommit,
    Hammer,
    LucideTerminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { Item, ItemContent, ItemTitle } from '@/components/ui/item';
import FullLoadingSpinner from '@/components/ui/full-loading-spinnter';
import ShortCommitHash from '@/components/custom/short-commit-hash';
import BuildStatusBadge from '@/app/builds/build-status-badge';
import { BuildLogsDialogContent } from '@/app/project/app/[appId]/overview/build-logs-overlay';
import { useNestedDrawer } from '@/app/project/[projectId]/app-components/app-drawer-components/nested-drawer';
import { deleteWorkloadBuildAction, getWorkloadBuildsAction } from '@/app/project/actions';
import { usePolling } from '@/frontend/hooks/use-polling';
import { useConfirmDialog } from '@/frontend/states/zustand.states';
import { formatDateTime } from '@/frontend/utils/format.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import { appBuildMethodLabels } from '@/shared/model/app-source-info.model';
import type { BuildJobModel } from '@/shared/model/build-job';

export function AgentBuildsGrid({ agentId }: { agentId: string }) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openNestedDrawer } = useNestedDrawer();
    const [builds, setBuilds] = useState<BuildJobModel[]>();

    const updateBuilds = useCallback(async () => {
        const response = await getWorkloadBuildsAction({
            workloadId: agentId,
            workloadType: 'agent',
        });
        if (response.status === 'success') {
            setBuilds(response.data ?? []);
        }
    }, [agentId]);

    usePolling(updateBuilds, {
        intervalMs: 10000,
        runImmediately: true,
    });

    const stopBuild = async (build: BuildJobModel) => {
        const confirmed = await openConfirmDialog({
            title: 'Stop Build',
            description: 'The build will be stopped and removed. Are you sure you want to stop this build?',
            okButton: 'Stop & Remove Build',
        });
        if (!confirmed) return;

        await Toast.fromAction(() => deleteWorkloadBuildAction(build.name, {
            workloadId: agentId,
            workloadType: 'agent',
        }));
        await updateBuilds();
    };

    const showLogs = (build: BuildJobModel) => {
        openNestedDrawer({
            title: 'Build Logs',
            description: `View the logs for the build started ${formatDateTime(build.startTime)}.`,
            content: (
                <BuildLogsDialogContent
                    deploymentInfo={{
                        buildJobName: build.name,
                        createdAt: build.startTime,
                        deploymentId: build.deploymentId,
                        gitCommit: build.gitCommit,
                        gitCommitMessage: build.gitCommitMessage,
                        status: 'BUILDING',
                        buildMethod: build.buildMethod,
                    }}
                    workloadId={agentId}
                    workloadType="agent"
                    hideHeader
                />
            ),
        });
    };

    if (!builds) {
        return (
            <div className="space-y-4">
                <div className="pl-2 text-lg font-semibold text-foreground/80">Latest Builds</div>
                <FullLoadingSpinner />
            </div>
        );
    }

    if (builds.length === 0) {
        return (
            <div className="space-y-4">
                <div className="pl-2 text-lg font-semibold text-foreground/80">Latest Builds</div>
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Hammer />
                        </EmptyMedia>
                        <EmptyTitle>No builds available</EmptyTitle>
                        <EmptyDescription>
                            This Agent Sandbox has no builds yet.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="pl-2 text-lg font-semibold text-foreground/80">Latest Builds</div>
            <div className="grid gap-2">
                {builds.map(build => (
                    <Item
                        key={build.name}
                        variant="outline"
                        className="flex-col items-stretch gap-2 px-4 py-3"
                    >
                        <div className="flex min-w-0 items-start gap-2">
                            <ItemContent>
                                <ItemTitle className="flex flex-wrap items-center gap-2 leading-normal">
                                    <BuildStatusBadge>{build.status}</BuildStatusBadge>
                                </ItemTitle>
                                {build.gitCommitMessage && (
                                    <div
                                        className="mt-2 text-xs text-muted-foreground"
                                        title={build.gitCommitMessage}
                                    >
                                        {build.gitCommitMessage.length > 200
                                            ? `${build.gitCommitMessage.slice(0, 200)}…`
                                            : build.gitCommitMessage}
                                    </div>
                                )}
                            </ItemContent>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 shrink-0"
                                onClick={() => showLogs(build)}
                            >
                                <LucideTerminal />
                                <span className="sr-only">Open build logs</span>
                            </Button>
                            {(build.status === 'RUNNING' || build.status === 'PENDING') && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger render={<Button size="icon" variant="ghost" className="size-7 shrink-0">
                                        <EllipsisVertical />
                                        <span className="sr-only">Build actions</span>
                                    </Button>} />
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => void stopBuild(build)}
                                        >
                                            Stop Build
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {build.gitCommit && <div className="flex items-center gap-1">
                                <GitCommit className="size-3" />
                                <ShortCommitHash smallVersion>{build.gitCommit}</ShortCommitHash>
                            </div>}
                            {build.gitCommit && <span aria-hidden="true">·</span>}
                            {build.buildMethod && <>
                                <span className="flex items-center gap-1">
                                    {build.buildMethod === 'DOCKERFILE' && <File className="size-3" />}
                                    {build.buildMethod === 'FRAMEWORK' && <Boxes className="size-3" />}
                                    {appBuildMethodLabels[build.buildMethod] ?? '-'}
                                </span>
                                <span aria-hidden="true">·</span>
                            </>}
                            <span>{formatDateTime(build.startTime)}</span>
                        </div>
                    </Item>
                ))}
            </div>
        </div>
    );
}
