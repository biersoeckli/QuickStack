'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { isAuthorizedWriteForApp, isAuthorizedWriteForWorkload, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { BasicAuthEditModel, basicAuthEditZodModel } from "@/shared/model/basic-auth-edit.model";
import { appNetworkPolicy } from "@/shared/model/network-policy.model";
import { HealthCheckModel, healthCheckZodModel } from "@/shared/model/health-check.model";
import appNetworkPolicyService from "@/server/services/app-network-policy.service";
import { AppNetworkPolicyRuleEditModel, appNetworkPolicyRuleEditZodModel, AppNetworkPolicySettingsModel, appNetworkPolicySettingsZodModel } from "@/shared/model/app-network-policy-edit.model";
import projectService from "@/server/services/project.service";
import { UserGroupUtils } from "@/shared/utils/role.utils";


export const saveBasicAuth = async (prevState: any, inputData: BasicAuthEditModel) =>
    saveFormAction(inputData, basicAuthEditZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(validatedData.appId);

        await appService.saveBasicAuth({
            ...validatedData,
            id: validatedData.id ?? undefined
        });

        return new SuccessActionResult();
    });

export const deleteBasicAuth = async (basicAuthId: string) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(await appService.getBasicAuthById(basicAuthId).then(b => b.appId));
        await appService.deleteBasicAuthById(basicAuthId);
        return new SuccessActionResult(undefined, 'Successfully deleted item');
    });

export const saveNetworkPolicy = async (appId: string, ingressPolicy: string, egressPolicy: string, useNetworkPolicy: boolean) =>
    simpleAction(async () => {
        await isAuthorizedWriteForApp(appId);

        // validate policies
        appNetworkPolicy.parse(ingressPolicy);
        appNetworkPolicy.parse(egressPolicy);

        const app = await appService.getById(appId);
        await appService.save({
            ...app,
            ingressNetworkPolicy: ingressPolicy,
            egressNetworkPolicy: egressPolicy,
            useNetworkPolicy: useNetworkPolicy,
            networkPolicyMode: 'SIMPLE',
        });
        return new SuccessActionResult(undefined, 'Network policy saved');
    });

export const saveAppNetworkPolicySettings = async (prevState: any, input: AppNetworkPolicySettingsModel, appId: string) =>
    saveFormAction(input, appNetworkPolicySettingsZodModel, async (validated) => {
        await isAuthorizedWriteForWorkload(appId);
        await appNetworkPolicyService.saveSettings({ ...validated, appId });
        return new SuccessActionResult();
    });

export const saveAppNetworkPolicyRule = async (prevState: any, input: AppNetworkPolicyRuleEditModel, appId: string) =>
    saveFormAction(input, appNetworkPolicyRuleEditZodModel, async (validated) => {
        const session = await isAuthorizedWriteForWorkload(appId);
        if (!UserGroupUtils.sessionHasReadAccessForProjectWorkload(session, validated.targetId)) throw new Error('You are not authorized to reference this target.');
        await appNetworkPolicyService.saveRule({ ...validated, appId });
        return new SuccessActionResult();
    });

export const deleteAppNetworkPolicyRule = async (ruleId: string) =>
    simpleAction(async () => {
        const rule = await appNetworkPolicyService.getRuleById(ruleId);
        await isAuthorizedWriteForWorkload(rule.appNetworkPolicy.appId);
        await appNetworkPolicyService.deleteRule(ruleId);
        return new SuccessActionResult();
    });

export const getTargetsForAppNetworkPolicy = async (appId: string) =>
    simpleAction(async () => {
        const session = await isAuthorizedWriteForWorkload(appId);
        const projects = await projectService.getAll();
        return projects.map(project => ({
            id: project.id, name: project.name,
            apps: project.apps.filter(app => app.id !== appId && UserGroupUtils.sessionHasReadAccessForApp(session, app.id)).map(app => ({ id: app.id, name: app.name })),
            agents: project.agents.filter(agent => UserGroupUtils.sessionHasReadAccessForAgent(session, agent.id)).map(agent => ({ id: agent.id, name: agent.name })),
        })).filter(project => project.apps.length > 0 || project.agents.length > 0);
    });

export const saveHealthCheck = async (prevState: any, inputData: HealthCheckModel) =>
    saveFormAction(inputData, healthCheckZodModel, async (validatedData) => {
        await isAuthorizedWriteForWorkload(validatedData.workloadId);

        const app = await appService.getById(validatedData.workloadId);

        // Prepare update data
        let updateData: Partial<typeof app> = {
            healthCheckPeriodSeconds: validatedData.periodSeconds,
            healthCheckTimeoutSeconds: validatedData.timeoutSeconds,
            healthCheckFailureThreshold: validatedData.failureThreshold,
        };

        if (validatedData.enabled) {
            if (validatedData.probeType === 'HTTP') {
                updateData = {
                    ...updateData,
                    healthChechHttpGetPath: validatedData.path || null,
                    healthCheckHttpPort: validatedData.httpPort || null,
                    healthCheckHttpScheme: validatedData.scheme || null,
                    healthCheckHttpHeadersJson: validatedData.headers && validatedData.headers.length > 0
                        ? JSON.stringify(validatedData.headers)
                        : null,
                    healthCheckTcpPort: null // Clear TCP when using HTTP
                };
            } else if (validatedData.probeType === 'TCP') {
                updateData = {
                    ...updateData,
                    healthCheckTcpPort: validatedData.tcpPort || null,
                    // Clear HTTP fields when using TCP
                    healthChechHttpGetPath: null,
                    healthCheckHttpPort: null,
                    healthCheckHttpScheme: null,
                    healthCheckHttpHeadersJson: null
                };
            }
        } else {
            // Clear all probe fields when disabled
            updateData = {
                ...updateData,
                healthChechHttpGetPath: null,
                healthCheckHttpPort: null,
                healthCheckHttpScheme: null,
                healthCheckHttpHeadersJson: null,
                healthCheckTcpPort: null
            };
        }

        await appService.save({
            ...app,
            ...updateData
        });

        return new SuccessActionResult(undefined, 'Health check settings saved');
    });
