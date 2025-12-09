import dataAccess from "../../adapter/db.client";
import { ServiceException } from "../../../shared/model/service.exception.model";
import mongoDbBackupService from "./database-backup-services/mongodb-backup.service";

class DatabaseBackupService {

    async backupDatabase(backupVolumeId: string) {
        console.log(`Running database backup for backupVolume ${backupVolumeId}`);

        const backupVolume = await dataAccess.client.volumeBackup.findFirstOrThrow({
            where: {
                id: backupVolumeId
            },
            include: {
                volume: {
                    include: {
                        app: true
                    }
                },
                target: true
            }
        });

        const app = backupVolume.volume.app;

        // Check if this is a database app type
        if (app.appType === 'APP') {
            throw new ServiceException(`App ${app.id} is not a database app. Use runBackupForVolume instead.`);
        }

        // Delegate to database-specific backup service
        if (app.appType === 'MONGODB') {
            return await mongoDbBackupService.backupMongoDb(backupVolumeId, backupVolume, app);
        }

        throw new ServiceException(`Database backup for ${app.appType} is not yet implemented.`);
    }
}

const databaseBackupService = new DatabaseBackupService();
export default databaseBackupService;
