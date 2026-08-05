import { UserGroup } from "@prisma/client";

export type UserExtended = {
    id: string;
    userGroup: UserGroup | null;
    userGroupId: string | null;
    email: string;
    createdAt: Date;
    updatedAt: Date;
    apiOnlyUser: boolean;
    apiKeyCount: number;
};
