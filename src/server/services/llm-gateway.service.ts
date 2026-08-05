import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { CryptoUtils } from "../utils/crypto.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import liteLlmApiAdapter from "../adapter/litellm-api.adapter";
import { LlmGatewayEditModel } from "@/shared/model/llm-gateway-edit.model";
import { LlmGatewayModel } from "@/shared/model/llm-gateway.model";

class LlmGatewayService {
    private get llmGatewayClient() {
        return (dataAccess.client as any).llmGateway;
    }

    private toUiModel(item: {
        id: string;
        name: string;
        baseUrl: string;
        encryptedAdminKey: string;
        createdAt: Date;
        updatedAt: Date;
    }): LlmGatewayModel {
        return {
            id: item.id,
            name: item.name,
            baseUrl: item.baseUrl,
            hasAdminKey: !!item.encryptedAdminKey,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    }

    normalizeBaseUrl(baseUrl: string) {
        const trimmed = baseUrl.trim();
        const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new ServiceException('LiteLLM Base URL must use http or https.');
        }

        parsed.username = '';
        parsed.password = '';
        parsed.search = '';
        parsed.hash = '';
        parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';

        return parsed.pathname === '/' ? parsed.origin : `${parsed.origin}${parsed.pathname}`;
    }

    async getAll() {
        return unstable_cache(async () => {
            const gateways = await this.llmGatewayClient.findMany({
                orderBy: { name: 'asc' },
            });
            return gateways.map((gateway: any) => this.toUiModel(gateway));
        }, [Tags.llmGateways()], {
            tags: [Tags.llmGateways()],
        })();
    }

    async getById(id: string) {
        const gateway = await this.llmGatewayClient.findFirstOrThrow({
            where: { id },
        });
        return this.toUiModel(gateway);
    }

    async deleteById(id: string) {
        const agentCount = await dataAccess.client.agent.count({
            where: { llmGatewayId: id },
        });
        if (agentCount > 0) {
            throw new ServiceException(
                'Cannot delete this LLM Gateway because it is still referenced by one or more Agents. Remove all Agents using this Gateway first.',
            );
        }

        try {
            await this.llmGatewayClient.deleteMany({
                where: { id },
            });
        } finally {
            revalidateTag(Tags.llmGateways());
        }
    }

    private async resolveAdminKey(input: Pick<LlmGatewayEditModel, 'id' | 'adminKey'>) {
        const enteredKey = input.adminKey?.trim();
        if (enteredKey) {
            return enteredKey;
        }

        if (!input.id) {
            throw new ServiceException('LiteLLM Admin Key is required.');
        }

        const existing = await this.llmGatewayClient.findFirstOrThrow({
            where: { id: input.id },
            select: { encryptedAdminKey: true },
        });
        return CryptoUtils.decrypt(existing.encryptedAdminKey);
    }

    async save(input: LlmGatewayEditModel) {
        const baseUrl = this.normalizeBaseUrl(input.baseUrl);
        const adminKey = await this.resolveAdminKey(input);

        const data = {
            name: input.name.trim(),
            baseUrl,
            encryptedAdminKey: CryptoUtils.encrypt(adminKey),
        };

        try {
            if (input.id) {
                const saved = await this.llmGatewayClient.update({
                    where: { id: input.id },
                    data,
                });
                return this.toUiModel(saved);
            }

            const saved = await this.llmGatewayClient.create({
                data,
            });
            return this.toUiModel(saved);
        } finally {
            revalidateTag(Tags.llmGateways());
        }
    }

    async testConnection(input: LlmGatewayEditModel) {
        const baseUrl = this.normalizeBaseUrl(input.baseUrl);
        const adminKey = await this.resolveAdminKey(input);
        const aliases = await liteLlmApiAdapter.listModelAliases(baseUrl, adminKey);
        return { aliases };
    }

    async getModelAliasesById(id: string) {
        const existing = await this.llmGatewayClient.findFirstOrThrow({
            where: { id },
        });
        return liteLlmApiAdapter.listModelAliases(
            existing.baseUrl,
            CryptoUtils.decrypt(existing.encryptedAdminKey),
        );
    }
}

const llmGatewayService = new LlmGatewayService();
export default llmGatewayService;
