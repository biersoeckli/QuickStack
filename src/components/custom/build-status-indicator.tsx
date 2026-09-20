'use client'

import { memo } from 'react';
import { CircleAlert } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
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
}

function BuildStatusIndicator({ appId, showLabel }: BuildStatusIndicatorProps) {
    const buildStatus = useBuildStatus(state => state.buildStatus.get(appId));

    if (!buildStatus) {
        return null;
    }

    if (isActiveBuildStatus(buildStatus.status)) {
        return (
            <Tooltip>
                <TooltipTrigger render={<div className="flex items-center gap-1.5 w-fit">
                        <Spinner className="size-3 text-blue-500" />
                        {showLabel && <span className="text-xs text-blue-700">{buildStatus.status === 'RUNNING' ? 'Building' : 'Pending'}</span>}
                    </div>} />
                <TooltipContent>
                    <p>{buildStatus.status === 'RUNNING' ? 'Build is running' : 'Build is queued'}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    if (buildStatus.status === 'FAILED') {
        return (
            <Tooltip>
                <TooltipTrigger render={<div className="flex items-center gap-1.5 w-fit">
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
