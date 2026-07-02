import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import dataAccess from "../adapter/db.client";
import namespaceService from "./namespace.service";
import agentService from "./agent.service";
import { AgentTemplateContentModel, AgentTemplateModel } from "@/shared/model/agent-template.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { agentTemplates, postCreateAgentTemplateFunctions } from "@/shared/templates/all-agent.templates";
import { AgentTemplateUtils } from "../utils/agent-template.utils";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import { CryptoUtils } from "../utils/crypto.utils";
import { Tags } from "../utils/cache-tag-generator.utils";
import { AgentExtendedWriteModel, AgentExtendedModel } from "@/shared/model/agent-extended.model";

class AgentTemplateService {
    async createAgentFromTemplate(projectId: string, template: AgentTemplateModel) {
        if (!agentTemplates.find((x) => x.name === template.name)) {
            throw new ServiceException(`Agent template with name '${template.name}' not found.`);
        }

        try {
            return await dataAccess.client.$transaction(async (tx) => {
                const project = await tx.project.findUnique({
                    where: { id: projectId },
                    select: { id: true, projectType: true },
                });
                if (!project) {
                    throw new ServiceException("Project not found.");
                }
                if (project.projectType !== "AGENT") {
                    throw new ServiceException("Agent templates can only be created in Agent Projects.");
                }

                const createdAgents: AgentExtendedModel[] = [];
                const context = {
                    templateName: template.name,
                    templates: template.templates.map((tmpl) => ({
                        agentName: tmpl.name,
                        inputSettings: tmpl.inputSettings,
                    })),
                };

                for (const tmpl of template.templates) {
                    const createdAgentId = await this.createAgentFromTemplateContent(projectId, tmpl, tx);
                    const extendedAgent = await tx.agent.findFirstOrThrow({
                        where: { id: createdAgentId },
                        include: {
                            project: true,
                            llmGateway: true,
                            agentDomains: true,
                            agentVolumes: true,
                            agentFileMounts: true,
                        },
                    });
                    createdAgents.push(extendedAgent as AgentExtendedModel);
                }

                const postCreate = postCreateAgentTemplateFunctions.get(template.name);
                if (postCreate) {
                    const updatedAgents = await postCreate(createdAgents, context);
                    for (const agent of updatedAgents) {
                        await agentService.saveAgentExtendedModel(agent as AgentExtendedWriteModel, tx);
                    }
                }

                return createdAgents;
            });
        } finally {
            revalidateTag(Tags.agents(projectId));
            revalidateTag(Tags.projects());
        }
    }

    private async createAgentFromTemplateContent(
        projectId: string,
        template: AgentTemplateContentModel,
        tx: Prisma.TransactionClient,
    ) {
        if (!template.llmGatewayId) {
            throw new ServiceException("Please select an LLM Gateway for each Agent.");
        }
        if (!template.modelAlias) {
            throw new ServiceException("Please select a model alias for each Agent.");
        }

        const gateway = await tx.llmGateway.findUnique({
            where: { id: template.llmGatewayId },
            select: { id: true },
        });
        if (!gateway) {
            throw new ServiceException("LLM Gateway not found.");
        }

        const { agent, envVars } = AgentTemplateUtils.mapTemplateInputValuesToAgent(template, template.inputSettings);
        const agentId = KubeObjectNameUtils.toAgentId(agent.name);
        const encryptedEnvVars = envVars.length > 0
            ? JSON.stringify(envVars.map((ev) => ({
                name: ev.name,
                value: CryptoUtils.encrypt(ev.value),
            })))
            : null;

        const { inputSettings, ...templateBase } = template;
        const writeModel: AgentExtendedWriteModel = {
            ...templateBase,
            ...agent,
            id: agentId,
            projectId,
            encryptedEnvVars,
        };

        await agentService.saveAgentExtendedModel(writeModel, tx);
        await namespaceService.createNamespaceIfNotExists(projectId);

        return agentId;
    }
}

const agentTemplateService = new AgentTemplateService();
export default agentTemplateService;
