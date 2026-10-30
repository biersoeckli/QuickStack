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
    user_id?: string;
    team_id?: string;
};
export type LiteLlmGenerateKeyResponse = components["schemas"]["GenerateKeyResponse"];
export type LiteLlmDeleteKeyRequest = components["schemas"]["KeyRequest"];
export type LiteLlmKeyListResponse = components["schemas"]["KeyListResponseObject"];
export type LiteLlmUserApiKey = components["schemas"]["UserAPIKeyAuth"];
export type LiteLlmCreateUserRequest = Partial<components["schemas"]["NewUserRequest"]> & {
    user_id: string;
    auto_create_key: false;
};
export type LiteLlmCreateUserResponse = components["schemas"]["NewUserResponse"];
export type LiteLlmUserInfoResponse = components["schemas"]["UserInfoResponse"];
