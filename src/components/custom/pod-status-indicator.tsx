'use client'

import { usePodsStatus } from '@/frontend/states/zustand.states';
import { cn } from '@/frontend/utils/utils';
import { Spinner } from "@/components/ui/spinner"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface PodStatusIndicatorProps {
    appId: string;
    showLabel?: boolean;
}

export default function PodStatusIndicator({ appId, showLabel }: PodStatusIndicatorProps) {
    const { getPodsForApp, isLoading } = usePodsStatus();
    const appPods = getPodsForApp(appId);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2">
                <Spinner className="size-3" />
            </div>
        );
    }

    if (!appPods) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 w-fit">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        {showLabel && <span className="text-xs text-gray-500">Unknown</span>}
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Could not retrieve deployment status</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    let statusColor = 'bg-gray-400';
    const runningPods = appPods.readyReplicas ?? 0;
    const expected = appPods.replicas ?? 0;
    let statusLabel = `${runningPods}/${expected}`;
    let tooltipText = `${runningPods} of ${expected} Pods running`;

    if (appPods.deploymentStatus === 'SHUTDOWN') {
        statusColor = 'bg-gray-400';
        statusLabel = 'Off';
        tooltipText = 'App is shut down';
    }

    if (appPods.deploymentStatus === 'DEPLOYING' || appPods.deploymentStatus === 'SHUTTING_DOWN') {
        statusColor = 'bg-orange-500';
    }

    if (appPods.deploymentStatus === 'DEPLOYED') {
        statusColor = 'bg-green-500';
        statusLabel = 'Ok';
    }

    if (appPods.deploymentStatus === 'ERROR') {
        statusColor = 'bg-red-500';
        statusLabel = 'Fehler';
        tooltipText = 'Error during deployment';
    }

    if (appPods.deploymentStatus === 'BUILDING') {
        statusColor = 'bg-blue-500';
        statusLabel = 'Build';
        tooltipText = 'App is building';
    }

    if (appPods.deploymentStatus === 'UNKNOWN') {
        statusColor = 'bg-gray-400';
        statusLabel = 'Unknown';
        tooltipText = 'Unknown deployment status';
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-2 w-fit">
                    <div className={cn("w-3 h-3 rounded-full", statusColor)} />
                    {showLabel && <span className="text-xs text-gray-700">{statusLabel}</span>}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltipText}</p>
            </TooltipContent>
        </Tooltip>
    );
}
