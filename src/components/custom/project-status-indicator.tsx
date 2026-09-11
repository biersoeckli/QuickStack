'use client'

import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePodsStatus } from '@/frontend/states/zustand.states';
import { Spinner } from "@/components/ui/spinner"
import { MultiStateProgress } from './multi-state-progress';

interface ProjectStatusIndicatorProps {
    projectId: string;
}

function ProjectStatusIndicator({ projectId }: ProjectStatusIndicatorProps) {
    const projectAppStatus = usePodsStatus(useShallow(state => Array.from(state.podsStatus.values()).filter(status => status.projectId === projectId)));
    const isLoading = usePodsStatus(state => state.isLoading);

    const projectStatus = useMemo(() => {
        if (projectAppStatus.length > 0) {
            const totalApps = projectAppStatus.length;
            const runningApps = projectAppStatus.filter(status => status.deploymentStatus === 'DEPLOYED').length;
            const shutdownApps = projectAppStatus.filter(status => status.deploymentStatus === 'SHUTDOWN').length;
            const errorAndDeployingApps = projectAppStatus.filter(status => ['UNKNOWN', 'ERROR', 'DEPLOYING', 'BUILDING', 'SHUTTING_DOWN'].includes(status.deploymentStatus)).length;
            return {
                runningAppsPercent: (runningApps / totalApps) * 100,
                shutdownAppsPercent: (shutdownApps / totalApps) * 100,
                errorAndDeployingAppsPercent: (errorAndDeployingApps / totalApps) * 100,
                runningAppsCount: runningApps,
                appCount: totalApps,
            };
        }
        return {
            runningAppsPercent: 0,
            shutdownAppsPercent: 100,
            errorAndDeployingAppsPercent: 0
        };
    }, [projectAppStatus]);

    if (isLoading || !projectStatus) {
        return (
            <div className="flex items-center gap-2">
                <Spinner className="size-3" />
            </div>
        );
    }

    return (

        <div className="space-y-1 pr-12">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{projectStatus.appCount && projectStatus.runningAppsCount && <>{projectStatus.runningAppsCount} / {projectStatus.appCount} apps running</>}</span>
            </div>
            <MultiStateProgress
                segments={[
                    { value: projectStatus.runningAppsPercent, color: 'green' },
                    { value: projectStatus.errorAndDeployingAppsPercent, color: 'orange' },
                    { value: projectStatus.shutdownAppsPercent, color: 'gray' }
                ]}
                className="h-2"
            />
        </div>
    );
}

export default memo(ProjectStatusIndicator);
