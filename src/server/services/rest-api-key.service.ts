import dataAccess from "../adapter/db.client";
import { revalidateTag, unstable_cache } from "next/cache";
import { Tags } from "../utils/cache-tag-generator.utils";
import crypto from 'crypto';
import { ServiceException } from "@/shared/model/service.exception.model";
import { ApiKeyHashUtils } from "../utils/api-key-hash.utils";

export type RestApiKeyMetadata = {
    id: string;
    name: string;
    createdAt: Date;
    expiresAt: Date | null;
};

class RestApiKeyService {

    async listByUserId(userId: string): Promise<RestApiKeyMetadata[]> {
        return unstable_cache(async (innerUserId) => await dataAccess.client.restApiKey.findMany({
            where: { userId: innerUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                createdAt: true,
                expiresAt: true,
            }
        }),
            [Tags.apiKey(userId)], // Cache key
            { tags: [Tags.apiKey(userId)] } // Cache tags for revalidation
        )(userId);
    }

    async create(userId: string, name: string, expiresAt?: Date | null) {
        const rawApiKey = crypto.randomBytes(48).toString('base64url');
        const keyHash = ApiKeyHashUtils.hashApiKey(rawApiKey);

        try {
            await dataAccess.client.restApiKey.create({
                data: {
                    userId,
                    name,
                    keyHash,
                    expiresAt: expiresAt ?? null,
                }
            });
        } catch (error: any) {
            if (error?.code === 'P2002') {
                throw new ServiceException('A REST API key with this name already exists.');
            }
            throw error;
        } finally {
            revalidateTag(Tags.users());
            revalidateTag(Tags.apiKey(userId));
        }

        return rawApiKey;
    }

    async deleteByIdForUser(userId: string, apiKeyId: string) {
        try {
            const deleted = await dataAccess.client.restApiKey.deleteMany({
                where: {
                    id: apiKeyId,
                    userId,
                }
            });

            if (deleted.count === 0) {
                throw new ServiceException('REST API key not found.');
            }
        } finally {
            revalidateTag(Tags.users());
            revalidateTag(Tags.apiKey(userId));
        }
    }

    async resolveUserByRawApiKey(rawApiKey: string) {
        const keyHash = ApiKeyHashUtils.hashApiKey(rawApiKey);
        const now = new Date();

        return dataAccess.client.restApiKey.findFirst({
            where: {
                keyHash,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } }
                ]
            },
            include: {
                user: true,
            }
        });
    }
}

const restApiKeyService = new RestApiKeyService();
export default restApiKeyService;
