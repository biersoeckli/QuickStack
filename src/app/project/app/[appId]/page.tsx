import { getAuthUserSession, isAuthorizedReadForApp } from "@/server/utils/action-wrapper.utils";
import appService from "@/server/services/app.service";
import AppTabs from "./app-tabs";
import AppBreadcrumbs from "./app-breadcrumbs";
import s3TargetService from "@/server/services/s3-target.service";
import volumeBackupService from "@/server/services/volume-backup.service";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import clusterService from "@/server/services/cluster.service";
import appGitSshKeyService from "@/server/services/app-git-ssh-key.service";

export default async function AppPage({
    searchParams,
    params
}: {
    searchParams?: Promise<{ [key: string]: string | undefined }>;
    params: Promise<{ appId: string }>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const appId = resolvedParams?.appId;
    if (!appId) {
        return <p>Could not find app with id {appId}</p>
    }
    const session = await isAuthorizedReadForApp(appId);
    const role = UserGroupUtils.getRolePermissionForApp(session, appId);
    const app = await appService.getExtendedById(appId);
    const [s3Targets, volumeBackups, nodesInfo, apps, gitSshPublicKey] = await Promise.all([
        s3TargetService.getAll(),
        volumeBackupService.getForApp(appId),
        clusterService.getNodeInfo(),
        appService.getAllAppsByProjectID(app.projectId),
        appGitSshKeyService.getPublicKey(appId),
    ]);

    return (<>
        <AppTabs
            role={role!}
            volumeBackups={volumeBackups}
            s3Targets={s3Targets}
            gitSshPublicKey={gitSshPublicKey}
            app={app}
            nodesInfo={nodesInfo}
            tabName={resolvedSearchParams?.tabName ?? 'overview'} />
        <AppBreadcrumbs app={app} apps={apps} tabName={resolvedSearchParams?.tabName} />
    </>
    )
}
