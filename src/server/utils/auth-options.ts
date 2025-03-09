import { PrismaClient, User } from "@prisma/client";
import NextAuth, { NextAuthOptions, Session } from "next-auth"
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { JWT } from "next-auth/jwt";
import { UserSession } from "@/shared/model/sim-session.model";
import dataAccess from "@/server/adapter/db.client";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import userService from "@/server/services/user.service";
import roleService from "@/server/services/role.service";


const saltRounds = 10;

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/auth",
    },
    providers: [
        CredentialsProvider({
            // The name to display on the sign in form (e.g. "Sign in with...")
            name: "Credentials",
            // `credentials` is used to generate a form on the sign in page.
            // You can specify which fields should be submitted, by adding keys to the `credentials` object.
            // e.g. domain, username, password, 2FA token, etc.
            // You can pass any HTML attribute to the <input> tag through the object.
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
                totpToken: { label: "TOTP Token", type: "text" },
            },
            async authorize(credentials, req) {
                if (!credentials) {
                    return null;
                }
                const authUserInfo = await userService.authorize(credentials);
                if (!authUserInfo) {
                    return null;
                }
                const user = await userService.getUserByEmail(authUserInfo.email);
                if (user.twoFaEnabled) {
                    if (!credentials.totpToken) {
                        return null;
                    }
                    const tokenValid = await userService.verifyTotpToken(authUserInfo.email, credentials.totpToken);
                    if (!tokenValid) {
                        return null;
                    }
                }
                return mapUser(user);
            }
        })
    ],
    adapter: PrismaAdapter(dataAccess.client),
};

function mapUser(user: User) {
    return {
        id: user.id,
        email: user.email
    };
}