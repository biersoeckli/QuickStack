vi.mock("next/cache", () => ({
    revalidateTag: vi.fn(),
}));

const dbProjectMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

const dbGatewayMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
}));

const dbAgentMocks = vi.hoisted(() => ({
    create: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
}));

const dbAgentDomainMocks = vi.hoisted(() => ({
    create: vi.fn(),
    deleteMany: vi.fn(),
}));

const dbAgentVolumeMocks = vi.hoisted(() => ({
    create: vi.fn(),
    deleteMany: vi.fn(),
}));

const dbAgentFileMountMocks = vi.hoisted(() => ({
    create: vi.fn(),
    deleteMany: vi.fn(),
}));

const namespaceServiceMocks = vi.hoisted(() => ({
    createNamespaceIfNotExists: vi.fn(),
}));

vi.mock("@/server/adapter/db.client", () => ({
    default: {
        client: {
            project: dbProjectMocks,
            llmGateway: dbGatewayMocks,
            agent: dbAgentMocks,
            agentDomain: dbAgentDomainMocks,
            agentVolume: dbAgentVolumeMocks,
            agentFileMount: dbAgentFileMountMocks,
            $transaction: vi.fn((fn: any) => fn({
                project: dbProjectMocks,
                llmGateway: dbGatewayMocks,
                agent: dbAgentMocks,
                agentDomain: dbAgentDomainMocks,
                agentVolume: dbAgentVolumeMocks,
                agentFileMount: dbAgentFileMountMocks,
            })),
        },
    },
}));

vi.mock("@/server/services/namespace.service", () => ({
    default: namespaceServiceMocks,
}));

vi.mock("@/server/utils/crypto.utils", () => ({
    CryptoUtils: {
        encrypt: vi.fn((value: string) => `encrypted:${value}`),
    },
}));

import agentTemplateService from "./agent-template.service";
import namespaceService from "./namespace.service";
import { opencodeAgentTemplate } from "@/shared/templates/agents/opencode.template";
import { ServiceException } from "@/shared/model/service.exception.model";

describe("agent-template.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbProjectMocks.findUnique.mockResolvedValue({ id: "project-1", projectType: "AGENT" });
        dbGatewayMocks.findUnique.mockResolvedValue({ id: "gateway-1" });
        dbAgentMocks.create.mockResolvedValue({ id: "agent-opencode", projectId: "project-1" });
        dbAgentMocks.findFirstOrThrow.mockResolvedValue({
            id: "agent-opencode",
            name: "OpenCode",
            projectId: "project-1",
            llmGatewayId: "gateway-1",
            modelAlias: "gpt-4o",
            sourceType: "CONTAINER",
            buildMethod: "DOCKERFILE",
            containerImageSource: "ghcr.io/anomalyco/opencode:latest",
            containerRegistryUsername: null,
            containerRegistryPassword: null,
            gitUrl: null,
            gitBranch: null,
            gitUsername: null,
            gitToken: null,
            dockerfilePath: "./Dockerfile",
            cpuRequest: null,
            cpuLimit: null,
            memoryRequest: null,
            memoryLimit: null,
            systemPrompt: null,
            encryptedEnvVars: null,
            containerCommand: null,
            containerArgs: null,
            warmPoolReplicas: 0,
            project: { id: "project-1", projectType: "AGENT" },
            llmGateway: { id: "gateway-1" },
            agentDomains: [],
            agentVolumes: [],
            agentFileMounts: [],
        });
        namespaceServiceMocks.createNamespaceIfNotExists.mockResolvedValue(undefined);
    });

    it("creates an OpenCode agent template with workspace volume", async () => {
        const template = structuredClone(opencodeAgentTemplate);
        template.templates[0].llmGatewayId = "gateway-1";
        template.templates[0].modelAlias = "gpt-4o";

        await agentTemplateService.createAgentFromTemplate("project-1", template);

        expect(dbAgentMocks.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id: expect.stringMatching(/^agent-open-code-/),
                name: "OpenCode",
                projectId: "project-1",
                llmGatewayId: "gateway-1",
                modelAlias: "gpt-4o",
                sourceType: "CONTAINER",
                buildMethod: "DOCKERFILE",
                containerImageSource: "ghcr.io/anomalyco/opencode:latest",
                warmPoolReplicas: 0,
            }),
        });
        expect(dbAgentVolumeMocks.create).toHaveBeenCalledWith({
            data: {
                containerMountPath: "/workspace",
                size: 10000,
                storageClassName: "longhorn",
                agentId: "agent-opencode",
            },
        });
        expect(namespaceService.createNamespaceIfNotExists).toHaveBeenCalledWith("project-1");
    });

    it("rejects non-agent projects", async () => {
        dbProjectMocks.findUnique.mockResolvedValue({ id: "project-1", projectType: "APP" });
        const template = structuredClone(opencodeAgentTemplate);
        template.templates[0].llmGatewayId = "gateway-1";
        template.templates[0].modelAlias = "gpt-4o";

        await expect(agentTemplateService.createAgentFromTemplate("project-1", template))
            .rejects.toThrow(ServiceException);
        expect(dbAgentMocks.create).not.toHaveBeenCalled();
    });
});
