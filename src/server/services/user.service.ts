import { Prisma, User } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import { revalidateTag, unstable_cache } from "next/cache";
import { Tags } from "../utils/cache-tag-generator.utils";
import bcrypt from "bcrypt";
import { ServiceException } from "@/shared/model/service.exception.model";
import QRCode from "qrcode";
import * as OTPAuth from "otpauth";
import { UserExtended } from "@/shared/model/user-extended.model";

const saltRounds = 10;

export class UserService {

    async changePassword(userMail: string, oldPassword: string, newPassword: string) {
        try {
            const user = await dataAccess.client.user.findUnique({
                where: {
                    email: userMail
                }
            });
            if (!user) {
                throw new ServiceException("User not found");
            }
            const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isPasswordValid) {
                throw new ServiceException("Old password is incorrect");
            }
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            await dataAccess.client.user.update({
                where: {
                    email: userMail
                },
                data: {
                    password: hashedPassword
                }
            });
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async changePasswordImediately(userMail: string, newPassword: string) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            await dataAccess.client.user.update({
                where: {
                    email: userMail
                },
                data: {
                    password: hashedPassword
                }
            });
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async updateUser(user: Prisma.UserUncheckedUpdateInput) {
        try {
            delete (user as any).password;
            await dataAccess.client.user.update({
                where: {
                    email: user.email as string
                },
                data: user
            });
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async maptoDtoUser(user: User) {
        return {
            email: user.email,
            twoFaEnabled: user.twoFaEnabled
        };
    }

    async authorize(credentials: Record<"password" | "username", string> | undefined) {
        try {
            if (!credentials || !credentials.username || !credentials.password) {
                return null;
            }
            const dbUser = await dataAccess.client.user.findFirst({
                where: {
                    email: credentials.username
                }
            });
            if (!dbUser) {
                return null;
            }
            const isPasswordValid = await bcrypt.compare(credentials.password, dbUser.password);
            if (!isPasswordValid) {
                return null;
            }
            return this.maptoDtoUser(dbUser);
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async registerUser(email: string, password: string, roleId: string | null) {
        try {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const user = await dataAccess.client.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    roleId
                }
            });
            return user;
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async getAllUsers(): Promise<UserExtended[]> {
        return await unstable_cache(async () => await dataAccess.client.user.findMany({
            select: {
                id: true,
                email: true,
                roleId: true,
                createdAt: true,
                updatedAt: true,
                role: true
            }
        }),
            [Tags.users()], {
            tags: [Tags.users()]
        })();
    }

    async getUserByEmail(email: string) {
        return await dataAccess.client.user.findFirstOrThrow({
            where: {
                email
            }
        });
    }

    async createNewTotpToken(userMail: string) {
        try {
            await this.getUserByEmail(userMail);

            let totpSecret = new OTPAuth.Secret({ size: 20 });

            let totp = new OTPAuth.TOTP({
                // Provider or service the account is associated with.
                issuer: "QuickStack",
                // Account identifier.
                label: userMail,
                // Algorithm used for the HMAC function.
                algorithm: "SHA1",
                // Length of the generated tokens.
                digits: 6,
                // Interval of time for which a token is valid, in seconds.
                period: 30,
                // Arbitrary key encoded in base32 or OTPAuth.Secret instance
                // (if omitted, a cryptographically secure random secret is generated).
                secret: totpSecret
            });

            let authenticatorUrl = totp.toString();
            const qrCodeForTotp = await QRCode.toDataURL(authenticatorUrl);

            await dataAccess.client.user.update({
                where: {
                    email: userMail
                },
                data: {
                    twoFaSecret: totp.secret.base32,
                    twoFaEnabled: false
                }
            });
            return qrCodeForTotp;
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async verifyTotpTokenAfterCreation(userMail: string, token: string) {
        try {
            const isVerified = await this.verifyTotpToken(userMail, token);
            if (!isVerified) {
                throw new ServiceException("Token is invalid");
            }
            await dataAccess.client.user.update({
                where: {
                    email: userMail
                },
                data: {
                    twoFaEnabled: true
                }
            });
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async verifyTotpToken(userMail: string, token: string) {
        const user = await this.getUserByEmail(userMail);
        if (!user.twoFaSecret) {
            throw new ServiceException("2FA is not enabled for this user");
        }
        const totp = new OTPAuth.TOTP({
            issuer: "QuickStack",
            label: user.email,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: user.twoFaSecret,
        });

        const delta = totp.validate({ token });
        return delta === 0; // 0 means the token is valid and was generated in the current time window, -1 and 1 mean the token is valid for the previous or next time window.
    }

    async deactivate2fa(userMail: string) {
        try {
            await this.getUserByEmail(userMail);
            await dataAccess.client.user.update({
                where: {
                    email: userMail
                },
                data: {
                    twoFaSecret: null,
                    twoFaEnabled: false
                }
            });
        } finally {
            revalidateTag(Tags.users());
        }
    }

    async deleteUserById(id: string) {
        try {
            const allUsers = await this.getAllUsers();
            if (allUsers.length <= 1) {
                throw new ServiceException("You cannot delete the last user");
            }
            await dataAccess.client.user.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.users());
        }
    }
}

const userService = new UserService();
export default userService;