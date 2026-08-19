import { User } from "@prisma/client";
import { NextAuthOptions } from "next-auth";
import { AdapterAccount, AdapterUser } from "next-auth/adapters";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import GitHubProvider from "next-auth/providers/github";
import dataAccess from "@/server/adapter/db.client";
import userService from "@/server/services/user.service";
import ssoProviderService from "@/server/services/sso-provider.service";
import { UserSession } from "@/shared/model/sim-session.model";

function mapOidcProfile(profile: Record<string, unknown>) {
  return {
    id: profile.sub as string,
    // Microsoft Entra ID does not guarantee an `email` claim for work and
    // school accounts. Its `preferred_username` claim is normally the UPN.
    email:
      (profile.email as string | undefined) ??
      (profile.preferred_username as string | undefined) ??
      (profile.upn as string | undefined),
    name:
      (profile.name as string | undefined) ??
      (profile.preferred_username as string | undefined),
    image: (profile.picture as string | null | undefined) ?? null,
  };
}

export function mapToNextAuthProvider(
  provider: Awaited<
    ReturnType<typeof ssoProviderService.getEnabledForAuth>
  >[number],
) {
  const common = {
    id: provider.id,
    name: provider.name,
    clientId: provider.clientId,
    clientSecret: provider.clientSecret,
    allowDangerousEmailAccountLinking: true,
  };

  switch (provider.type) {
    case "OIDC":
      return {
        ...common,
        type: "oauth" as const,
        wellKnown: `${provider.issuer!.replace(/\/$/, "")}/.well-known/openid-configuration`,
        authorization: { params: { scope: "openid email profile" } },
        profile: mapOidcProfile,
      };
    case "GOOGLE":
      return GoogleProvider(common);
    case "AZURE_AD":
      return AzureADProvider({
        ...common,
        tenantId: provider.tenantId!,
        profile: mapOidcProfile,
      });
    case "GITHUB":
      return GitHubProvider(common);
  }
}

export async function buildAuthOptions(): Promise<NextAuthOptions> {
  const ssoProviders = await ssoProviderService.getEnabledForAuth();
  return {
    session: { strategy: "jwt" },
    pages: { signIn: "/auth" },
    providers: [
      CredentialsProvider({
        name: "Credentials",
        credentials: {
          username: { label: "Username", type: "text" },
          password: { label: "Password", type: "password" },
          totpToken: { label: "TOTP Token", type: "text" },
        },
        async authorize(credentials) {
          if (!credentials) {
            return null;
          }
          const authUserInfo = await userService.authorize(
            credentials as Record<"password" | "username", string>,
          );
          if (!authUserInfo) {
            return null;
          }
          const user = await userService.getUserByEmail(authUserInfo.email);
          if (
            user.twoFaEnabled &&
            (!credentials.totpToken ||
              !(await userService.verifyTotpToken(
                authUserInfo.email,
                credentials.totpToken,
              )))
          ) {
            return null;
          }
          return mapUser(user);
        },
      }),
      ...ssoProviders.map(mapToNextAuthProvider),
    ],
    callbacks: {
      async jwt(data) {
        if (data.token?.email) {
          const user = await userService.findUserByEmail(data.token.email);
          if (user) {
            data.token.userId = user.id;
          }
        }
        return data.token;
      },
      async session({ session, token }) {
        if (token?.userId) {
          (session.user as UserSession).userId = token.userId as string;
          return session;
        }
        throw new Error("Could not generate session");
      },
    },
    events: {
      async linkAccount({ user, account }) {
        if (account.provider === "credentials") {
          return;
        }
        const provider = await ssoProviderService.getById(account.provider);
        const existingUser = await userService.findUserByEmail(user.email!);
        if (provider && existingUser && !existingUser.userGroupId) {
          await userService.setUserGroup(
            existingUser.id,
            provider.defaultUserGroupId,
          );
        }
      },
    },
    // OAuth users do not have a local credential. Keep an empty password so
    // the existing required User.password column works on upgraded databases.
    adapter: {
      ...PrismaAdapter(dataAccess.client),
      createUser: (user: AdapterUser) =>
        dataAccess.client.user.create({ data: { ...user, password: "" } }),
      // OIDC providers may return non-standard token fields (for example
      // Azure's `ext_expires_in`). Prisma only accepts fields in Account.
      linkAccount: (account: AdapterAccount) =>
        dataAccess.client.account.create({
          data: {
            userId: account.userId,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          },
        }),
    },
  };
}

function mapUser(user: User) {
  return { id: user.id, email: user.email };
}
