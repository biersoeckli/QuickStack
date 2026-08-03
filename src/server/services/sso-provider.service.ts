import { SsoProvider, SsoProviderType } from "@prisma/client";
import { revalidateTag } from "next/cache";
import dataAccess from "@/server/adapter/db.client";
import { CryptoUtils } from "@/server/utils/crypto.utils";
import { Tags } from "@/server/utils/cache-tag-generator.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import {
  SsoProviderEditModel,
  SsoProviderUiModel,
} from "@/shared/model/sso-provider.model";

type AuthProvider = Omit<SsoProvider, "clientSecretEnc"> & {
  clientSecret: string;
};

let authCache: { expiresAt: number; providers: AuthProvider[] } | undefined;
const CACHE_TTL_MS = 30_000;

class SsoProviderService {

  private clearAuthCache() {
    authCache = undefined;
  }

  private toUiModel(provider: SsoProvider): SsoProviderUiModel {
    return {
      id: provider.id,
      type: provider.type,
      name: provider.name,
      enabled: provider.enabled,
      clientId: provider.clientId,
      issuer: provider.issuer ?? "",
      tenantId: provider.tenantId ?? "",
      defaultUserGroupId: provider.defaultUserGroupId,
      hasClientSecret: !!provider.clientSecretEnc,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  async getAll(): Promise<SsoProviderUiModel[]> {
    const providers = await dataAccess.client.ssoProvider.findMany({ orderBy: { name: "asc" } });
    return providers.map((provider) => this.toUiModel(provider));
  }

  async getById(id: string) {
    return dataAccess.client.ssoProvider.findUnique({ where: { id } });
  }

  async getEnabledForAuth(): Promise<AuthProvider[]> {
    if (authCache && authCache.expiresAt > Date.now()) {
      return authCache.providers;
    }
    const providers = await dataAccess.client.ssoProvider.findMany({ where: { enabled: true } });
    const decrypted = providers.map(({ clientSecretEnc, ...provider }) => ({
      ...provider,
      clientSecret: CryptoUtils.decrypt(clientSecretEnc),
    }));
    authCache = { providers: decrypted, expiresAt: Date.now() + CACHE_TTL_MS };
    return decrypted;
  }

  async save(input: SsoProviderEditModel) {
    const enteredSecret = input.clientSecret.trim();
    if (!input.id && !enteredSecret) {
      throw new ServiceException("Client secret is required.");
    }
    const clientSecretEnc = enteredSecret
      ? CryptoUtils.encrypt(enteredSecret)
      : (
        await dataAccess.client.ssoProvider.findUniqueOrThrow({
          where: { id: input.id! },
          select: { clientSecretEnc: true },
        })
      ).clientSecretEnc;

    const data = {
      type: input.type as SsoProviderType,
      name: input.name.trim(),
      enabled: input.enabled,
      clientId: input.clientId.trim(),
      clientSecretEnc,
      issuer: input.type === "OIDC" ? input.issuer.trim() : null,
      tenantId: input.type === "AZURE_AD" ? input.tenantId.trim() : null,
      defaultUserGroupId: input.defaultUserGroupId,
    };

    try {
      const provider = input.id
        ? await dataAccess.client.ssoProvider.update({ where: { id: input.id }, data })
        : await dataAccess.client.ssoProvider.create({ data });
      return this.toUiModel(provider);
    } finally {
      this.clearAuthCache();
      revalidateTag(Tags.ssoProviders());
    }
  }

  async deleteById(id: string) {
    try {
      await dataAccess.client.ssoProvider.delete({ where: { id } });
    } finally {
      this.clearAuthCache();
      revalidateTag(Tags.ssoProviders());
    }
  }
}

export const ssoProviderCacheTtlMs = CACHE_TTL_MS;
const ssoProviderService = new SsoProviderService();
export default ssoProviderService;
