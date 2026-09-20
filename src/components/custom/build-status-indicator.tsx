'use client'

import { memo, type MouseEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/frontend/utils/utils';
import { useDialog } from '@/frontend/states/zustand.states';
import { BuildLogsDialogContent } from '@/app/project/app/[appId]/overview/build-logs-overlay';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuildStatus } from '@/frontend/states/zustand.states';
import { isActiveBuildStatus } from '@/shared/model/app-build-status.model';

interface BuildStatusIndicatorProps {
    appId: string;
    showLabel?: boolean;
    className?: string;
}

function BuildStatusIndicator({ appId, showLabel, className }: BuildStatusIndicatorProps) {
    const buildStatus = useBuildStatus(state => state.buildStatus.get(appId));
    const { openDialog } = useDialog();

    if (!buildStatus) {
        return null;
    }

    if (isActiveBuildStatus(buildStatus.status)) {
        const canShowLogs = (buildStatus.status === 'RUNNING' || buildStatus.status === 'PENDING') && !!buildStatus.deploymentId;
        const showLogs = (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            if (!canShowLogs || !buildStatus.deploymentId) return;
            openDialog(
                <BuildLogsDialogContent
                    deploymentInfo={{
                        deploymentId: buildStatus.deploymentId,
                        createdAt: buildStatus.startedAt ?? new Date(),
                        status: 'BUILDING',
                        gitCommit: buildStatus.gitCommit,
                        gitCommitMessage: buildStatus.gitCommitMessage,
                        buildMethod: buildStatus.buildMethod,
                    }}
                    workloadId={buildStatus.workloadId}
                    workloadType={buildStatus.workloadType}
                />,
                { maxWidth: '1300px' },
            );
        };

        return (
            <Tooltip>
                <TooltipTrigger render={<button type="button" onClick={showLogs} className={cn('flex w-fit items-center gap-1.5', canShowLogs && 'cursor-pointer', className)}>
                    <Spinner className="size-3 text-blue-500" />
                    {showLabel && <span className="text-xs text-blue-700">{buildStatus.status === 'RUNNING' ? 'Building' : 'Pending'}</span>}
                </button>} />
                <TooltipContent>
                    <p>{buildStatus.status === 'RUNNING' ? 'Build is running' : 'Build is queued'}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    if (buildStatus.status === 'FAILED') {
        return (
            <Tooltip>
                <TooltipTrigger render={<div className={cn('flex w-fit items-center gap-1.5', className)}>
                    <CircleAlert className="size-3.5 text-red-500" />
                    {showLabel && <span className="text-xs text-red-700">Build failed</span>}
                </div>} />
                <TooltipContent>
                    <p>Last build failed</p>
                    {buildStatus.gitCommitMessage && <p>{buildStatus.gitCommitMessage}</p>}
                </TooltipContent>
            </Tooltip>
        );
    }

    return null;
}

export default memo(BuildStatusIndicator);
