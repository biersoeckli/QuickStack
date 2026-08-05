import { components } from "./litellm.openapi";

export type LiteLlmModelInfo = Omit<Partial<components["schemas"]["Deployment"]>, 'litellm_params' | 'model_info'> & {
    model_name?: string;
    model_info?: Record<string, unknown> | null;
    litellm_params?: Record<string, unknown> | null;
    [key: string]: unknown;
};

export type LiteLlmModelInfoResponse = {
    data?: LiteLlmModelInfo[];
};

export type LiteLlmGenerateKeyRequest = Partial<components["schemas"]["GenerateKeyRequest"]> & {
    models: string[];
};
export type LiteLlmGenerateKeyResponse = components["schemas"]["GenerateKeyResponse"];
export type LiteLlmDeleteKeyRequest = components["schemas"]["KeyRequest"];
