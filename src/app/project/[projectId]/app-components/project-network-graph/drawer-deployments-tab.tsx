import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { useNestedDrawer } from "./drawer/nested-drawer";
import { DeploymentInfoModel } from "@/shared/model/deployment-info.model";
import { BuildLogsDialogContent } from "@/app/project/app/[appId]/overview/build-logs-overlay";
import BuildsTab from "@/app/project/app/[appId]/overview/deployments";
import { formatDateTime } from "@/frontend/utils/format.utils";




export default function DrawerDeploymentsTab({
    app,
    role,
}: {
    app: AppExtendedModel;
    role: RolePermissionEnum;
}) {
    const { openNestedDrawer } = useNestedDrawer();

    const showLogs = (deployment: DeploymentInfoModel) => {
        openNestedDrawer({
            title: 'Deployment Logs',
            description: `View the logs for the selected deployment ${formatDateTime(deployment.createdAt)}.`,
            content: (
                <BuildLogsDialogContent
                    deploymentInfo={deployment}
                    workloadId={app.id}
                    workloadType="app"
                    hideHeader
                />
            ),
        });
    };

    return <BuildsTab app={app} role={role} view="grid" onShowLogs={showLogs} />;
}