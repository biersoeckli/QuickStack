import { Role, User } from "@prisma/client";

export type UserExtended = {
    id: string;
    role: Role | null;
    roleId: string | null;
    email: string;
    createdAt: Date;
    updatedAt: Date;
};
