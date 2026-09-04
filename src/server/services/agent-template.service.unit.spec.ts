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
    findUnique: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
}));

const dbAgentDomainMocks = vi.hoisted(() => ({
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
}));

const dbAgentVolumeMocks = vi.hoisted(() => ({
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
}));

const dbAgentFileMountMocks = vi.hoisted(() => ({
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
}));

const dbAgentNetworkPolicyMocks = vi.hoisted(() => ({
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
            agentNetworkPolicy: dbAgentNetworkPolicyMocks,
            $transaction: vi.fn((fn: any) => fn({
                project: dbProjectMocks,
                llmGateway: dbGatewayMocks,
                agent: dbAgentMocks,
                agentDomain: dbAgentDomainMocks,
                agentVolume: dbAgentVolumeMocks,
                agentFileMount: dbAgentFileMountMocks,
                agentNetworkPolicy: dbAgentNetworkPolicyMocks,
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

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

import agentTemplateService from "./agent-template.service";
import namespaceService from "./namespace.service";
import { opencodeAgentTemplate } from "@/shared/templates/agents/opencode.template";
import { ServiceException } from "@/shared/model/service.exception.model";

describe("agent-template.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbProjectMocks.findUnique.mockResolvedValue({ id: "project-1", projectType: "AGENT" });
        dbGatewayMocks.findUnique.mockResolvedValue({ id: "gateway-1", baseUrl: "https://litellm.example" });
        dbAgentMocks.findUnique.mockResolvedValue(null);
        dbAgentMocks.create.mockResolvedValue({ id: "agent-opencode", projectId: "project-1" });
        dbAgentMocks.update.mockResolvedValue({ id: "agent-opencode", projectId: "project-1" });
        dbAgentDomainMocks.findMany.mockResolvedValue([]);
        dbAgentVolumeMocks.findMany.mockResolvedValue([]);
        dbAgentFileMountMocks.findMany.mockResolvedValue([]);
        dbAgentMocks.findFirstOrThrow.mockResolvedValue({
            id: "agent-opencode",
            name: "OpenCode",
            projectId: "project-1",
            llmGatewayId: "gateway-1",
            modelAlias: JSON.stringify(["gpt-4o"]),
            sourceType: "CONTAINER",
            buildMethod: "DOCKERFILE",
            containerImageSource: "ghcr.io/anomalyco/opencode:1.18.27",
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
            containerCommand: JSON.stringify([
                "/bin/sh",
                "-lc",
            ]),
            containerArgs: JSON.stringify([
                "exec opencode web --hostname 0.0.0.0 --port 4096",
            ]),
            workingDir: "/workspace",
            warmPoolReplicas: 0,
            deployFileBrowser: false,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: 3,
            project: { id: "project-1", projectType: "AGENT" },
            llmGateway: { id: "gateway-1", baseUrl: "https://litellm.example" },
            agentDomains: [],
            agentVolumes: [],
            agentFileMounts: [],
            agentNetworkPolicy: null,
        });
        namespaceServiceMocks.createNamespaceIfNotExists.mockResolvedValue(undefined);
    });

    it("creates an OpenCode agent template with workspace volume", async () => {
        const template = structuredClone(opencodeAgentTemplate);
        template.templates[0].llmGatewayId = "gateway-1";
        template.templates[0].modelAlias = ["gpt-4o"];

        await agentTemplateService.createAgentFromTemplate("project-1", template);

        expect(dbAgentMocks.update).toHaveBeenCalledWith({
            where: { id: "agent-opencode" },
            data: expect.objectContaining({
                id: "agent-opencode",
                name: "OpenCode",
                projectId: "project-1",
                llmGatewayId: "gateway-1",
                modelAlias: JSON.stringify(["gpt-4o"]),
                sourceType: "CONTAINER",
                buildMethod: "DOCKERFILE",
                containerImageSource: "ghcr.io/anomalyco/opencode:1.18.27",
                warmPoolReplicas: 0,
            }),
        });
        expect(dbAgentVolumeMocks.create).toHaveBeenCalledWith({
            data: {
                containerMountPath: "/workspace",
                size: 5120,
                storageClassName: "longhorn",
                agentId: "agent-opencode",
            },
        });
        expect(dbAgentFileMountMocks.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                containerMountPath: "/root/.config/opencode/opencode.json",
                agentId: "agent-opencode",
            }),
        });
        const opencodeConfigMount = dbAgentFileMountMocks.create.mock.calls.find(([call]) =>
            call.data.containerMountPath === "/root/.config/opencode/opencode.json"
        )?.[0];
        expect(JSON.parse(opencodeConfigMount.data.content)).toEqual(expect.objectContaining({
            model: "quickstack-litellm/gpt-4o",
            provider: expect.objectContaining({
                "quickstack-litellm": expect.objectContaining({
                    options: expect.objectContaining({
                        baseURL: "https://litellm.example/v1",
                        apiKey: "{env:QS_VIRTUAL_KEY}",
                    }),
                }),
            }),
            server: {
                hostname: "0.0.0.0",
                port: 4096,
            },
        }));
        expect(namespaceService.createNamespaceIfNotExists).toHaveBeenCalledWith("project-1");
    });

    it("rejects non-agent projects", async () => {
        dbProjectMocks.findUnique.mockResolvedValue({ id: "project-1", projectType: "APP" });
        const template = structuredClone(opencodeAgentTemplate);
        template.templates[0].llmGatewayId = "gateway-1";
        template.templates[0].modelAlias = ["gpt-4o"];

        await expect(agentTemplateService.createAgentFromTemplate("project-1", template))
            .rejects.toThrow(ServiceException);
        expect(dbAgentMocks.create).not.toHaveBeenCalled();
        expect(dbAgentMocks.update).not.toHaveBeenCalled();
    });
});
