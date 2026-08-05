import { RequesterIdentity } from "./shared-authorization.utils";
import userGroupService from "../services/user-group.service";
import restApiKeyService from "../services/rest-api-key.service";

export async function getIdentityFromApiKeyHeader(authorizationHeader: string | null): Promise<RequesterIdentity | null> {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return null;
    }

    const rawApiKey = authorizationHeader.slice('Bearer '.length).trim();
    if (!rawApiKey) {
        return null;
    }

    const apiKeyRecord = await restApiKeyService.resolveUserByRawApiKey(rawApiKey);
    if (!apiKeyRecord) {
        return null;
    }

    const userGroup = await userGroupService.getRoleByUserMail(apiKeyRecord.user.email);

    return {
        type: 'apiKey',
        session: {
            userId: apiKeyRecord.user.id,
            email: apiKeyRecord.user.email,
            userGroup: userGroup ?? undefined,
        }
    };
}
