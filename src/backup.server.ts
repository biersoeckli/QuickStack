import dataAccess from "./server/adapter/db.client";
import backupService from "./server/services/standalone-services/backup.service";


export default async function registreAllBackupSchedules() {

    const volumeBackups = await dataAccess.client.volumeBackup.findMany();
    console.log(`Registering ${volumeBackups.length} backup schedules...`);
    for (const volumeBackup of volumeBackups) {
        await backupService.registerBackupJob(volumeBackup);
    }
    console.log('Backup schedules registered.');
}