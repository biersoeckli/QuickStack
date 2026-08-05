export type LlmGatewayModel = {
    id: string;
    name: string;
    baseUrl: string;
    hasAdminKey: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type LlmGatewayConnectionTestResult = {
    aliases: string[];
};
