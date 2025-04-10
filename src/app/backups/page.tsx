'use server'

import { getAuthUserSession, isAuthorizedForBackups } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import backupService from "@/server/services/standalone-services/backup.service";
import BackupsTable from "./backups-table";
import { AlertCircle } from "lucide-react"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"


export default async function BackupsPage() {

    await isAuthorizedForBackups();
    const {
        backupInfoModels,
        backupsVolumesWithoutActualBackups
    } = await backupService.getBackupsForAllS3Targets();

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Backups'}
                subtitle={`View all backups wich are stored in all S3 Target destinations. If a backup exists from an app wich doesnt exist anymore, it will be shown as orphaned.`}>
            </PageTitle>
            <div className="space-y-6">
                {backupsVolumesWithoutActualBackups.length > 0 && <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Apps without Backup</AlertTitle>
                    <AlertDescription>
                        The following apps have backups configured, but until now no backups were created for them:<br />
                        {backupsVolumesWithoutActualBackups.map((item) => `${item.volume.app.name} (mount: ${item.volume.containerMountPath})`).join(', ')}
                    </AlertDescription>
                </Alert>}
                {backupsVolumesWithoutActualBackups.length === 0 && backupInfoModels.length === 0 && <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Backups configured</AlertTitle>
                    <AlertDescription>
                        No backups are currently stored in the S3 targets. To configure backups for your apps, navigate to the settings of each app and configure a backup schedule in the "Storage" tab.
                    </AlertDescription>
                </Alert>}
                <BackupsTable data={backupInfoModels} />
            </div>
        </div>
    )
}
