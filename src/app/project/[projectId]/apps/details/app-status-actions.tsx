'use client';


import {
    ExternalLink,
    Hammer,
    Play,
    Rocket,
    Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';




import PodStatusIndicator from '@/components/custom/pod-status-indicator';
import { deploy, startApp, stopApp } from '@/app/project/[projectId]/apps/details/actions';
import { usePodsStatus } from '@/frontend/states/zustand.states';
import { AppLifecycleUtils } from '@/frontend/utils/app-lifecycle.utils';
import { Toast } from '@/frontend/utils/toast.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model';



export function AppStatusActions({
    app,
    role,
}: {
    app: AppExtendedModel;
    role?: RolePermissionEnum;
}) {
    const deploymentStatus = usePodsStatus(
        (state) => state.podsStatus.get(app.id)?.deploymentStatus ?? 'UNKNOWN',
    );
    const lifecycle = AppLifecycleUtils.availability(app, role, deploymentStatus);
    const openDomain = (domain: AppExtendedModel['appDomains'][number]) => {
        const protocol = domain.useSsl ? 'https' : 'http';

        window.open(`${protocol}://${domain.hostname}`, '_blank');
    };

    return (
        <div className="flex w-fit max-w-full flex-wrap items-center gap-1 bg-stone-100 rounded-2xl pl-4 pr-2 py-1">
            <PodStatusIndicator appId={app.id} />
            {(lifecycle.canManage || app.appDomains.length > 0) && (
                <TooltipProvider delay={300}>
                    <div className="ml-2 flex flex-wrap items-center gap-1 pl-2">
                        {lifecycle.canManage && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={!lifecycle.canDeploy}
                                                onClick={() => void Toast.fromAction(() => deploy(app.id))}
                                            >
                                                <Rocket />
                                                <span className="sr-only">Deploy</span>
                                            </Button>
                                        }
                                    />
                                    <TooltipContent>Deploy</TooltipContent>
                                </Tooltip>
                                {lifecycle.supportsRebuild && (
                                    <Tooltip>
                                        <TooltipTrigger
                                            render={
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    disabled={!lifecycle.canRebuild}
                                                    onClick={() => void Toast.fromAction(() => deploy(app.id, true))}
                                                >
                                                    <Hammer />
                                                    <span className="sr-only">Rebuild</span>
                                                </Button>
                                            }
                                        />
                                        <TooltipContent>Rebuild</TooltipContent>
                                    </Tooltip>
                                )}
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={!lifecycle.canStart}
                                                onClick={() => void Toast.fromAction(() => startApp(app.id))}
                                            >
                                                <Play />
                                                <span className="sr-only">Start</span>
                                            </Button>
                                        }
                                    />
                                    <TooltipContent>Start</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="hover:bg-destructive/10 hover:text-destructive"
                                                disabled={!lifecycle.canStop}
                                                onClick={() => void Toast.fromAction(() => stopApp(app.id))}
                                            >
                                                <Square />
                                                <span className="sr-only">Stop</span>
                                            </Button>
                                        }
                                    />
                                    <TooltipContent>Stop</TooltipContent>
                                </Tooltip>
                            </>
                        )}
                        {app.appDomains.length === 1 && (
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => openDomain(app.appDomains[0])}
                                        >
                                            <ExternalLink />
                                            <span className="sr-only">Open domain</span>
                                        </Button>
                                    }
                                />
                                <TooltipContent>Open domain</TooltipContent>
                            </Tooltip>
                        )}
                        {app.appDomains.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Open domain"
                                            title="Open domain"
                                        >
                                            <ExternalLink />
                                        </Button>
                                    }
                                />
                                <DropdownMenuContent align="end" className="w-fit">
                                    {app.appDomains.map((domain) => (
                                        <DropdownMenuItem
                                            key={domain.id}
                                            onClick={() => openDomain(domain)}
                                        >
                                            <ExternalLink />
                                            {domain.hostname}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </TooltipProvider>
            )}
        </div>
    );
}

