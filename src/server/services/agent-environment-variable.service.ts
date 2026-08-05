import { revalidateTag } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { CryptoUtils } from "../utils/crypto.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentEnvVarEditModel } from "@/shared/model/agent-config.model";

class AgentEnvironmentVariableService {

    async saveEnvironmentVariable(agentId: string, environmentVariable: AgentEnvVarEditModel) {
        const agent = await dataAccess.client.agent.findUniqueOrThrow({
            where: { id: agentId },
            select: { id: true, projectId: true, encryptedEnvVars: true },
        });

        try {
            const envVars = agent.encryptedEnvVars ? JSON.parse(agent.encryptedEnvVars) as Array<{ name: string; value: string }> : [];
            const currentIndex = environmentVariable.originalName
                ? envVars.findIndex((envVar) => envVar.name === environmentVariable.originalName)
                : -1;

            if (environmentVariable.originalName && currentIndex === -1) {
                throw new ServiceException('Environment variable not found.');
            }
            if (envVars.some((envVar, index) => index !== currentIndex && envVar.name.toUpperCase() === environmentVariable.name.toUpperCase())) {
                throw new ServiceException(`Duplicate environment variable name: "${environmentVariable.name}".`);
            }

            const savedEnvVar = { name: environmentVariable.name, value: CryptoUtils.encrypt(environmentVariable.value) };
            if (currentIndex === -1) {
                envVars.push(savedEnvVar);
            } else {
                envVars[currentIndex] = savedEnvVar;
            }

            await dataAccess.client.agent.update({
                where: { id: agentId },
                data: { encryptedEnvVars: JSON.stringify(envVars) },
            });
        } finally {
            revalidateTag(Tags.agent(agent.id));
            revalidateTag(Tags.agents(agent.projectId));
        }
    }

    async deleteEnvironmentVariable(agentId: string, name: string) {
        const agent = await dataAccess.client.agent.findUniqueOrThrow({
            where: { id: agentId },
            select: { id: true, projectId: true, encryptedEnvVars: true },
        });

        try {
            const envVars = agent.encryptedEnvVars ? JSON.parse(agent.encryptedEnvVars) as Array<{ name: string; value: string }> : [];
            const remainingEnvVars = envVars.filter((envVar) => envVar.name !== name);
            if (remainingEnvVars.length === envVars.length) {
                throw new ServiceException('Environment variable not found.');
            }

            await dataAccess.client.agent.update({
                where: { id: agentId },
                data: { encryptedEnvVars: remainingEnvVars.length ? JSON.stringify(remainingEnvVars) : null },
            });
        } finally {
            revalidateTag(Tags.agent(agent.id));
            revalidateTag(Tags.agents(agent.projectId));
        }
    }
}

const agentEnvironmentVariableService = new AgentEnvironmentVariableService();
export default agentEnvironmentVariableService;
