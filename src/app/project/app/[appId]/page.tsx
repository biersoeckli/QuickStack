import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import appService from "@/server/services/app.service";
import AppTabs from "./app-tabs";
import AppBreadcrumbs from "./app-breadcrumbs";
import s3TargetService from "@/server/services/s3-target.service";
import volumeBackupService from "@/server/services/volume-backup.service";

export default async function AppPage({
    searchParams,
    params
}: {
    searchParams?: { [key: string]: string | undefined };
    params: { appId: string }
}) {
    await getAuthUserSession();
    const appId = params?.appId;
    if (!appId) {
        return <p>Could not find app with id {appId}</p>
    }
    const [app, s3Targets, volumeBackups] = await Promise.all([
        appService.getExtendedById(appId),
        s3TargetService.getAll(),
        volumeBackupService.getForApp(appId)
    ]);

    return (<>
        <AppTabs
            volumeBackups={volumeBackups}
            s3Targets={s3Targets}
            app={app}
            tabName={searchParams?.tabName ?? 'overview'} />
        <AppBreadcrumbs app={app} />
    </>
    )
}
