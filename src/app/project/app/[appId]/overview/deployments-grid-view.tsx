import { DotsVerticalIcon } from '@radix-ui/react-icons';
import { File, GitCommit, LucideTerminal, RotateCcw } from 'lucide-react';
import ShortCommitHash from '@/components/custom/short-commit-hash';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemContent, ItemTitle } from '@/components/ui/item';
import { formatDateTime } from '@/frontend/utils/format.utils';
import type { DeploymentInfoModel } from '@/shared/model/deployment-info.model';
import DeploymentStatusBadge from './deployment-status-badge';

type DeploymentsGridViewProps = {
    deployments: DeploymentInfoModel[];
    canStopBuild: (deployment: DeploymentInfoModel) => boolean;
    canRollback: (deployment: DeploymentInfoModel) => boolean;
    onShowLogs: (deployment: DeploymentInfoModel) => void;
    onStopBuild: (deployment: DeploymentInfoModel) => void;
    onRollback: (deployment: DeploymentInfoModel) => void;
};

export function DeploymentsGridView({
    deployments,
    canStopBuild,
    canRollback,
    onShowLogs,
    onStopBuild,
    onRollback,
}: DeploymentsGridViewProps) {
    if (deployments.length === 0) {
        return <p className="py-8 text-center text-sm text-muted-foreground">No deployments yet.</p>;
    }

    return (
        <div className="grid gap-2">
            {deployments.map(deployment => (
                <Item
                    key={deployment.deploymentId}
                    variant="outline"
                    className="flex-col items-stretch gap-2 p-2.5"
                >
                    <div className="flex min-w-0 items-start gap-2">
                        <ItemContent>
                            <ItemTitle className="flex flex-wrap items-center gap-2 leading-normal">
                                <DeploymentStatusBadge>{deployment.status}</DeploymentStatusBadge>
                                {deployment.isRollback && (
                                    <span className="rounded-lg bg-purple-100 px-2 py-1 text-sm font-semibold text-purple-800">
                                        Rollback
                                    </span>
                                )}
                            </ItemTitle>
                            {deployment.gitCommitMessage && (
                                <div
                                    className="mt-2 text-xs text-muted-foreground"
                                    title={deployment.gitCommitMessage}
                                >
                                    {deployment.gitCommitMessage.length > 200
                                        ? `${deployment.gitCommitMessage.slice(0, 200)}…`
                                        : deployment.gitCommitMessage}
                                </div>
                            )}
                        </ItemContent>
                        <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => onShowLogs(deployment)}>
                            <LucideTerminal />
                            <span className="sr-only">Open Terminal</span>
                        </Button>
                        {(canStopBuild(deployment) || canRollback(deployment)) && <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="size-7 shrink-0">
                                    <DotsVerticalIcon />
                                    <span className="sr-only">Deployment actions</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {canStopBuild(deployment) && (
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={() => onStopBuild(deployment)}
                                    >
                                        Stop Build
                                    </DropdownMenuItem>
                                )}
                                {canRollback(deployment) && (
                                    <DropdownMenuItem onSelect={() => onRollback(deployment)}>
                                        <RotateCcw />
                                        Rollback to this deployment
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>}
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {deployment.gitCommit && <div className="flex items-center gap-1">
                            <GitCommit className="size-3" />
                            <ShortCommitHash smallVersion={true}>{deployment.gitCommit}</ShortCommitHash>
                        </div>}
                        {deployment.gitCommit && <span aria-hidden="true">·</span>}
                        {deployment.buildMethod && <>
                            <span>
                                {deployment.buildMethod === 'DOCKERFILE'
                                    ? <div className="flex items-center gap-1">
                                        <File className="size-3" />
                                        Dockerfile
                                    </div>
                                    : 'Railpack'}
                            </span>
                            <span aria-hidden="true">·</span>
                        </>}
                        <span>{formatDateTime(deployment.createdAt)}</span>
                    </div>
                </Item>
            ))}
        </div>
    );
}
