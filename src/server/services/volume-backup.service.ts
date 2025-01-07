import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Prisma, VolumeBackup } from "@prisma/client";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";

class VolumeBackupService {

    async getAll(): Promise<VolumeBackupExtendedModel[]> {
        return await unstable_cache(() => dataAccess.client.volumeBackup.findMany({
            orderBy: {
                cron: 'asc'
            },
            include: {
                target: true
            }
        }),
            [Tags.volumeBackups()], {
            tags: [Tags.volumeBackups()]
        })();
    }

    async getForApp(appId: string): Promise<VolumeBackupExtendedModel[]> {
        return await unstable_cache((appId: string) => dataAccess.client.volumeBackup.findMany({
            where: {
                volume: {
                    appId
                }
            },
            include: {
                target: true
            },
            orderBy: {
                cron: 'asc'
            }
        }),
            [Tags.volumeBackups()], {
            tags: [Tags.volumeBackups()]
        })(appId);
    }

    async getById(id: string) {
        return dataAccess.client.volumeBackup.findFirstOrThrow({
            where: {
                id
            }
        });
    }

    async save(item: Prisma.VolumeBackupUncheckedCreateInput | Prisma.VolumeBackupUncheckedUpdateInput) {
        let savedItem: VolumeBackup;
        try {
            if (item.id) {
                savedItem = await dataAccess.client.volumeBackup.update({
                    where: {
                        id: item.id as string
                    },
                    data: item,
                });
            } else {
                savedItem = await dataAccess.client.volumeBackup.create({
                    data: item as Prisma.VolumeBackupUncheckedCreateInput,
                });
            }
        } finally {
            revalidateTag(Tags.volumeBackups());
        }
        return savedItem;
    }

    async deleteById(id: string) {
        const existingItem = await this.getById(id);
        if (!existingItem) {
            return;
        }
        try {
            await dataAccess.client.volumeBackup.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.volumeBackups());
        }
    }
}

const volumeBackupService = new VolumeBackupService();
export default volumeBackupService;
