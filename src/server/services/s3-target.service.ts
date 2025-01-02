import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Prisma, S3Target } from "@prisma/client";
import namespaceService from "./namespace.service";

class S3TargetService {

    async deleteById(id: string) {
        const existingItem = await this.getById(id);
        if (!existingItem) {
            return;
        }
        try {
            await dataAccess.client.s3Target.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.s3Targets());
        }
    }

    async getAll() {
        return await unstable_cache(() =>  dataAccess.client.s3Target.findMany({
            orderBy: {
                name: 'asc'
            }
        }),
            [Tags.s3Targets()], {
            tags: [Tags.s3Targets()]
        })();
    }

    async getById(id: string) {
        return dataAccess.client.s3Target.findFirstOrThrow({
            where: {
                id
            }
        });
    }

    async save(item: Prisma.S3TargetUncheckedCreateInput | Prisma.S3TargetUncheckedUpdateInput) {
        let savedItem: S3Target;
        try {
            if (item.id) {
                savedItem = await dataAccess.client.s3Target.update({
                    where: {
                        id: item.id as string
                    },
                    data: item
                });
            } else {
                savedItem = await dataAccess.client.s3Target.create({
                    data: item as Prisma.S3TargetUncheckedCreateInput
                });
            }
        } finally {
            revalidateTag(Tags.s3Targets());
        }
        return savedItem;
    }
}

const s3TargetService = new S3TargetService();
export default s3TargetService;
