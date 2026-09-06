import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { useCallback, useEffect, useState } from "react";
import { deleteBuild, getDeploymentsAndBuildsForApp, rollbackToDeployment } from "./actions";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { DeploymentInfoModel } from "@/shared/model/deployment-info.model";
import DeploymentStatusBadge from "./deployment-status-badge";
import { BuildLogsDialog } from "./build-logs-overlay";
import ShortCommitHash from "@/components/custom/short-commit-hash";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RotateCcw } from "lucide-react";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { GitHashUtils } from "@/shared/utils/git-hash.utils";

export default function BuildsTab({
    app,
    role
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
}) {

    const { openConfirmDialog: openDialog } = useConfirmDialog();
    const [appBuilds, setAppBuilds] = useState<DeploymentInfoModel[] | undefined>(undefined);
    const [, setError] = useState<string | undefined>(undefined);
    const [selectedDeploymentForLogs, setSelectedDeploymentForLogs] = useState<DeploymentInfoModel | undefined>(undefined);

    const updateBuilds = useCallback(async () => {
        setError(undefined);
        try {
            const response = await getDeploymentsAndBuildsForApp(app.id);
            if (response.status === 'success' && response.data) {
                setAppBuilds(response.data);
            } else {
                console.error(response);
                setError(response.message ?? 'An unknown error occurred.');
            }
        } catch (ex) {
            console.error(ex);
            setError('An unknown error occurred.');
        }
    }, [app.id])

    const deleteBuildClick = async (buildName: string) => {
        const confirm = await openDialog({
            title: "Delete Build",
            description: "The build will be stopped and removed. Are you sure you want to stop this build?",
            okButton: "Stop & Remove Build"
        });
        if (confirm) {
            await Toast.fromAction(() => deleteBuild(buildName));
            await updateBuilds();
        }
    }

    const rollbackClick = async (item: DeploymentInfoModel) => {
        const confirm = await openDialog({
            title: "Rollback Deployment",
            description: `Roll back to git commit ${GitHashUtils.shortGitHash(item.gitCommit)}? The App will be redeployed with the code from this commit.`,
            okButton: "Rollback"
        });
        if (confirm) {
            await Toast.fromAction(() => rollbackToDeployment(app.id, item.deploymentId));
            await updateBuilds();
        }
    }

    useEffect(() => {
        if (app.sourceType === 'container') {
            return;
        }
        updateBuilds();
        const intervalId = setInterval(updateBuilds, 10000);
        return () => clearInterval(intervalId);
    }, [app, updateBuilds]);


    if (app.sourceType === 'container') {
        return <></>;
    }

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Deployments</CardTitle>
                <CardDescription>This is an overview of the last deplyoments for this App.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!appBuilds ? <FullLoadingSpinner /> :
                    <SimpleDataTable columns={[
                        ['replicasetName', 'Deployment Name', false],
                        ['buildJobName', 'Build Job Name', false],
                        ['deploymentId', 'Deployment Id', false],
                        ['status', 'Status', true, (item) => (
                            <div className="flex items-center gap-2">
                                <DeploymentStatusBadge>{item.status}</DeploymentStatusBadge>
                                {item.isRollback && <span className="px-2 py-1 rounded-lg text-sm font-semibold bg-purple-100 text-purple-800">Rollback</span>}
                            </div>
                        )],
                        ['buildMethod', 'Build Method', true, (item) => (
                            <span className="text-muted-foreground text-sm">
                                {item.buildMethod ? (item.buildMethod === 'DOCKERFILE' ? 'Dockerfile' : 'Railpack') : '—'}
                            </span>
                        )],
                        ["startTime", "Started At", true, (item) => formatDateTime(item.createdAt)],
                        ['gitCommit', 'Git Commit', true, (item) => <ShortCommitHash>{item.gitCommit}</ShortCommitHash>],
                        ['gitCommitMessage', 'Commit Message', true, (item) => <span className="text-muted-foreground text-sm">{item.gitCommitMessage ?? ''}</span>],
                    ]}
                        data={appBuilds}
                        hideSearchBar={true}
                        actionCol={(item) => {
                            return <>
                                <div className="flex gap-4">
                                    <div className="flex-1"></div>
                                    {item.deploymentId && <Button variant="secondary" onClick={() => setSelectedDeploymentForLogs(item)}>Show Logs</Button>}
                                    {role === RolePermissionEnum.READWRITE && item.buildJobName && item.status === 'BUILDING' && <Button variant="destructive" onClick={() => deleteBuildClick(item.buildJobName!)}>Stop Build</Button>}
                                    {role === RolePermissionEnum.READWRITE && item.gitCommit && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline">
                                                    <DotsVerticalIcon></DotsVerticalIcon>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => rollbackClick(item)}>
                                                    <RotateCcw />
                                                    Rollback to this deployment
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </>
                        }}
                    />
                }
            </CardContent>
        </Card>
        <BuildLogsDialog deploymentInfo={selectedDeploymentForLogs} onClose={() => setSelectedDeploymentForLogs(undefined)} />
    </>;
}
