import { getAuthUserSession, isAuthorizedReadForApp } from "@/server/utils/action-wrapper.utils";
import appService from "@/server/services/app.service";
import AppTabs from "./app-tabs";
import AppBreadcrumbs from "./app-breadcrumbs";
import s3TargetService from "@/server/services/s3-target.service";
import volumeBackupService from "@/server/services/volume-backup.service";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import clusterService from "@/server/services/cluster.service";

export default async function AppPage({
    searchParams,
    params
}: {
    searchParams?: { [key: string]: string | undefined };
    params: { appId: string }
}) {
    const appId = params?.appId;
    if (!appId) {
        return <p>Could not find app with id {appId}</p>
    }
    const session = await isAuthorizedReadForApp(appId);
    const role = UserGroupUtils.getRolePermissionForApp(session, appId);
    const [app, s3Targets, volumeBackups, nodesInfo] = await Promise.all([
        appService.getExtendedById(appId),
        s3TargetService.getAll(),
        volumeBackupService.getForApp(appId),
        clusterService.getNodeInfo()
    ]);

    return (<>
        <AppTabs
            role={role!}
            volumeBackups={volumeBackups}
            s3Targets={s3Targets}
            app={app}
            nodesInfo={nodesInfo}
            tabName={searchParams?.tabName ?? 'overview'} />
        <AppBreadcrumbs app={app} />
    </>
    )
}
