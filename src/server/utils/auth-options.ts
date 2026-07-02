import { User } from "@prisma/client";
import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import dataAccess from "@/server/adapter/db.client";
import CredentialsProvider from "next-auth/providers/credentials";
import userService from "@/server/services/user.service";
import { UserSession } from "@/shared/model/sim-session.model";

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
    callbacks: {
        async jwt(data) {
            // Initial sign in - store user info in token
            if (data.token && data.token.email) {
                const user = await userService.getUserByEmail(data.token.email);
                const userId = user.id;
                if (userId) {
                    data.token.userId = userId;
                }
            }
            return data.token;
        },
        async session({ session, token, user }) {
            // Read user info from token and builds session object
            if (token?.userId) {
                const userSession = session.user as UserSession;
                userSession.userId = token.userId as string;
                session.user = userSession;
                return session;
            }

            console.error('Could not generate session - missing userId in token');
            console.error('session', session);
            console.error('token', token);
            console.error('user', user);
            throw new Error("Could not generate session");
        }
    },
    adapter: PrismaAdapter(dataAccess.client),
};

function mapUser(user: User) {
    return {
        id: user.id,
        email: user.email
    };
}