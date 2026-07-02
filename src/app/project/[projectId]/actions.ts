'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { getAuthUserSession, isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { z } from "zod";
import appTemplateService from "@/server/services/app-template.service";
import { AppTemplateModel, appTemplateZodModel } from "@/shared/model/app-template.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import dbGateService from "@/server/services/db-tool-services/dbgate.service";
import fileBrowserService from "@/server/services/file-browser-service";
import phpMyAdminService from "@/server/services/db-tool-services/phpmyadmin.service";
import pgAdminService from "@/server/services/db-tool-services/pgadmin.service";
import {
    ensureCreateProjectWorkloadInProject,
    ensureDeleteProjectWorkloadInProject,
    RequesterIdentity,
} from "@/server/utils/shared-authorization.utils";
import agentService from "@/server/services/agent.service";
import llmGatewayService from "@/server/services/llm-gateway.service";
import agentTemplateService from "@/server/services/agent-template.service";
import { AgentTemplateModel, agentTemplateZodModel } from "@/shared/model/agent-template.model";

const createAppSchema = z.object({
    appName: z.string().min(1)
});

const createAgentSchema = z.object({
    agentName: z.string().min(1),
    llmGatewayId: z.string().min(1),
    modelAlias: z.string().min(1),
});

export const createApp = async (appName: string, projectId: string, appId?: string) =>
    saveFormAction({ appName }, createAppSchema, async (validatedData) => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        ensureCreateProjectWorkloadInProject(identity, projectId);

        const returnData = await appService.save({
            id: appId ?? undefined,
            name: validatedData.appName,
            projectId
        });

        return new SuccessActionResult(returnData, "App created successfully.");
    });

export const createAppFromTemplate = async (prevState: any, inputData: AppTemplateModel, projectId: string) =>
    saveFormAction(inputData, appTemplateZodModel, async (validatedData) => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        ensureCreateProjectWorkloadInProject(identity, projectId);
        if (validatedData.templates.some(x => x.inputSettings.some(y => !y.randomGeneratedIfEmpty && !y.value))) {
            throw new ServiceException('Please fill out all required fields.');
        }
        await appTemplateService.createAppFromTemplate(projectId, validatedData);
    });

export const createAgentFromTemplate = async (prevState: any, inputData: AgentTemplateModel, projectId: string) =>
    saveFormAction(inputData, agentTemplateZodModel, async (validatedData) => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        ensureCreateProjectWorkloadInProject(identity, projectId);
        if (validatedData.templates.some(x => x.inputSettings.some(y => !y.randomGeneratedIfEmpty && !y.value))) {
            throw new ServiceException('Please fill out all required fields.');
        }
        if (validatedData.templates.some(x => !x.llmGatewayId || !x.modelAlias)) {
            throw new ServiceException('Please select an LLM Gateway and model alias for each Agent.');
        }
        await agentTemplateService.createAgentFromTemplate(projectId, validatedData);
    });

export const createAgent = async (agentName: string, projectId: string, llmGatewayId: string, modelAlias: string) =>
    saveFormAction({ agentName, llmGatewayId, modelAlias }, createAgentSchema, async (validatedData) => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        ensureCreateProjectWorkloadInProject(identity, projectId);

        const returnData = await agentService.saveAgent({
            name: validatedData.agentName,
            projectId,
            llmGatewayId: validatedData.llmGatewayId,
            modelAlias: validatedData.modelAlias,
        });

        return new SuccessActionResult(returnData, 'Agent created successfully.');
    });

export const getLlmGateways = async () =>
    simpleAction(async () => {
        await getAuthUserSession();
        return await llmGatewayService.getAll();
    });

export const getModelAliasesForGateway = async (gatewayId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        return await llmGatewayService.getModelAliasesById(gatewayId);
    });

export const deleteApp = async (appId: string) =>
    simpleAction(async () => {
        const session = await getAuthUserSession();
        const identity: RequesterIdentity = { type: 'session', session };
        const app = await appService.getExtendedById(appId);
        ensureDeleteProjectWorkloadInProject(identity, app.projectId);
        // First delete external services wich might be running
        await dbGateService.deleteToolForAppIfExists(appId);
        await phpMyAdminService.deleteToolForAppIfExists(appId);
        await pgAdminService.deleteToolForAppIfExists(appId);
        for (const volume of app.appVolumes) {
            await fileBrowserService.deleteFileBrowserForVolumeIfExists(volume.id);
        }
        // delete the app drom database and all kubernetes objects
        await appService.deleteById(appId);
    });
