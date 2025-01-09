'use client'

import { Button } from "@/components/ui/button";

import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { List } from "lucide-react";
import { BackupInfoModel } from "@/shared/model/backup-info.model";
import { BackupDetailDialog } from "./backup-detail-overlay";



export default function BackupsTable({ data }: { data: BackupInfoModel[] }) {


    return <>
        <SimpleDataTable columns={[
            ['projectId', 'Project ID', false],
            ['projectName', 'Project', true],
            ['appName', 'App', true],
            ['appId', 'App ID', false],
            ['backupVolumeId', 'Backup Volume ID', false],
            ['volumeId', 'Volume ID', false],
            ['mountPath', 'Mount Path', true],
            ['backupRetention', 'Retention', false],
            ['backupsCount', 'Backups', true, (item) => `${item.backups.length} backups`],
            ['item.backups[0].backupDate', 'Last Backup', true, (item) => formatDateTime(item.backups[0].backupDate)],
        ]}
            data={data}
            actionCol={(item) =>
                <>
                    <div className="flex">
                        <div className="flex-1"></div>
                        <BackupDetailDialog backupInfo={item}>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">show backups</span>
                                <List className="h-4 w-4" />
                            </Button>
                        </BackupDetailDialog>
                    </div>
                </>}
        />
    </>
}