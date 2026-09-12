import { useCallback, useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import FullLoadingSpinner from '@/components/ui/full-loading-spinnter';
import { usePolling } from '@/frontend/hooks/use-polling';
import { useConfirmDialog, useDialog } from '@/frontend/states/zustand.states';
import { Toast } from '@/frontend/utils/toast.utils';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import type { DeploymentInfoModel } from '@/shared/model/deployment-info.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';
import { GitHashUtils } from '@/shared/utils/git-hash.utils';
import {
    deleteBuild,
    getDeploymentsAndBuildsForApp,
    rollbackToDeployment,
} from './actions';
import { BuildLogsDialogContent } from './build-logs-overlay';
import { DeploymentsDefaultView } from './deployments-default-view';
import { DeploymentsGridView } from './deployments-grid-view';

export type BuildsTabView = 'default' | 'grid';

export default function BuildsTab({
    app,
    role,
    view = 'default',
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
    view?: BuildsTabView;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();
    const [appBuilds, setAppBuilds] = useState<DeploymentInfoModel[]>();
    const [, setError] = useState<string>();

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
        } catch (error) {
            console.error(error);
            setError('An unknown error occurred.');
        }
    }, [app.id]);

    const stopBuild = async (deployment: DeploymentInfoModel) => {
        if (!deployment.buildJobName) return;
        const confirmed = await openConfirmDialog({
            title: 'Delete Build',
            description: 'The build will be stopped and removed. Are you sure you want to stop this build?',
            okButton: 'Stop & Remove Build',
        });
        if (!confirmed) return;
        await Toast.fromAction(() => deleteBuild(deployment.buildJobName!));
        await updateBuilds();
    };

    const rollback = async (deployment: DeploymentInfoModel) => {
        const confirmed = await openConfirmDialog({
            title: 'Rollback Deployment',
            description: `Roll back to git commit ${GitHashUtils.shortGitHash(deployment.gitCommit)}? The App will be redeployed with the code from this commit.`,
            okButton: 'Rollback',
        });
        if (!confirmed) return;
        await Toast.fromAction(() => rollbackToDeployment(app.id, deployment.deploymentId));
        await updateBuilds();
    };

    const showLogs = (deployment: DeploymentInfoModel) =>
        openDialog(
            <BuildLogsDialogContent
                deploymentInfo={deployment}
                workloadId={app.id}
                workloadType="app"
            />,
            { maxWidth: '1300px' },
        );
    const canStopBuild = (deployment: DeploymentInfoModel) =>
        role === RolePermissionEnum.READWRITE
        && !!deployment.buildJobName
        && deployment.status === 'BUILDING';
    const canRollback = (deployment: DeploymentInfoModel) =>
        role === RolePermissionEnum.READWRITE
        && !!deployment.replicasetName
        && !!deployment.gitCommit
        && deployment.status !== 'DEPLOYING'
        && deployment.status !== 'DEPLOYED';

    usePolling(updateBuilds, {
        intervalMs: 10000,
        enabled: app.sourceType !== 'container',
        runImmediately: true,
    });

    if (app.sourceType === 'container') return null;

    const viewProps = {
        deployments: appBuilds ?? [],
        canStopBuild,
        canRollback,
        onShowLogs: showLogs,
        onStopBuild: (deployment: DeploymentInfoModel) => void stopBuild(deployment),
        onRollback: (deployment: DeploymentInfoModel) => void rollback(deployment),
    };

    if (view === 'grid') {
        return !appBuilds
            ? <FullLoadingSpinner />
            : <DeploymentsGridView {...viewProps} />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Deployments</CardTitle>
                <CardDescription>
                    This is an overview of the last deplyoments for this App.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!appBuilds ? <FullLoadingSpinner /> : <DeploymentsDefaultView {...viewProps} />}
            </CardContent>
        </Card>
    );
}
