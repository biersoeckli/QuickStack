import { DotsVerticalIcon } from '@radix-ui/react-icons';
import { RotateCcw } from 'lucide-react';
import { SimpleDataTable } from '@/components/custom/simple-data-table';
import ShortCommitHash from '@/components/custom/short-commit-hash';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDateTime } from '@/frontend/utils/format.utils';
import type { DeploymentInfoModel } from '@/shared/model/deployment-info.model';
import DeploymentStatusBadge from './deployment-status-badge';

type DeploymentsDefaultViewProps = {
    deployments: DeploymentInfoModel[];
    canStopBuild: (deployment: DeploymentInfoModel) => boolean;
    canRollback: (deployment: DeploymentInfoModel) => boolean;
    onShowLogs: (deployment: DeploymentInfoModel) => void;
    onStopBuild: (deployment: DeploymentInfoModel) => void;
    onRollback: (deployment: DeploymentInfoModel) => void;
};

export function DeploymentsDefaultView({
    deployments,
    canStopBuild,
    canRollback,
    onShowLogs,
    onStopBuild,
    onRollback,
}: DeploymentsDefaultViewProps) {
    return (
        <SimpleDataTable
            columns={[
                ['replicasetName', 'Deployment Name', false],
                ['buildJobName', 'Build Job Name', false],
                ['deploymentId', 'Deployment Id', false],
                ['status', 'Status', true, deployment => (
                    <div className="flex items-center gap-2">
                        <DeploymentStatusBadge>{deployment.status}</DeploymentStatusBadge>
                        {deployment.isRollback && (
                            <span className="rounded-lg bg-purple-100 px-2 py-1 text-sm font-semibold text-purple-800">
                                Rollback
                            </span>
                        )}
                    </div>
                )],
                ['buildMethod', 'Build Method', true, deployment => (
                    <span className="text-sm text-muted-foreground">
                        {deployment.buildMethod
                            ? deployment.buildMethod === 'DOCKERFILE'
                                ? 'Dockerfile'
                                : 'Railpack'
                            : '—'}
                    </span>
                )],
                ['startTime', 'Started At', true, deployment => formatDateTime(deployment.createdAt)],
                ['gitCommit', 'Git Commit', true, deployment => (
                    <ShortCommitHash>{deployment.gitCommit}</ShortCommitHash>
                )],
                ['gitCommitMessage', 'Commit Message', true, deployment => (
                    <span className="text-sm text-muted-foreground">
                        {deployment.gitCommitMessage ?? ''}
                    </span>
                )],
            ]}
            data={deployments}
            hideSearchBar
            actionCol={deployment => (
                <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" onClick={() => onShowLogs(deployment)}>
                        Show Logs
                    </Button>
                    {canStopBuild(deployment) && (
                        <Button variant="destructive" onClick={() => onStopBuild(deployment)}>
                            Stop Build
                        </Button>
                    )}
                    {canRollback(deployment) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    <DotsVerticalIcon />
                                    <span className="sr-only">Deployment actions</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => onRollback(deployment)}>
                                    <RotateCcw />
                                    Rollback to this deployment
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}
        />
    );
}
