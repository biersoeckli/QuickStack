'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { isAuthorizedWriteForApp, isAuthorizedWriteForWorkload, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { BasicAuthEditModel, basicAuthEditZodModel } from "@/shared/model/basic-auth-edit.model";
import { HealthCheckModel, healthCheckZodModel } from "@/shared/model/health-check.model";
import appNetworkPolicyService from "@/server/services/app-network-policy.service";
import networkPolicyService from "@/server/services/network-policy.service";
import namespaceService from "@/server/services/namespace.service";
import { AppNetworkPolicyConfigurationModel, appNetworkPolicyConfigurationZodModel } from "@/shared/model/app-network-policy-edit.model";
import projectService from "@/server/services/project.service";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import { ServiceException } from "@/shared/model/service.exception.model";


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

export const saveAppNetworkPolicyConfiguration = async (prevState: any, input: AppNetworkPolicyConfigurationModel) =>
    saveFormAction(input, appNetworkPolicyConfigurationZodModel, async (validated) => {
        const session = await isAuthorizedWriteForWorkload(validated.appId);
        for (const rule of validated.rules) {
            if (!rule.id && !UserGroupUtils.sessionHasReadAccessForProjectWorkload(session, rule.targetId)) {
                throw new ServiceException('You are not authorized to reference this target.');
            }
        }
        const touches = await appNetworkPolicyService.savePolicyConfiguration(validated, session);

        // Network policies are applied immediately: the changed App and every
        // related App referenced by its rules are reconciled in Kubernetes.
        // Peers whose mirrored counterpart was removed are reconciled too, so a
        // deleted connection is dropped from their network policy as well.
        // Agent counterparts are stored in the database only; agent sandbox
        // templates are not updated.
        const appIdsToReconcile = [validated.appId, ...validated.rules
            .filter(rule => rule.targetType === 'APP')
            .map(rule => rule.targetId)];
        for (const touch of touches) {
            if (touch.workloadType === 'APP') {
                appIdsToReconcile.push(touch.workloadId);
            }
        }
        for (const appId of new Set(appIdsToReconcile)) {
            const app = await appService.getExtendedById(appId, false);
            await namespaceService.createNamespaceIfNotExists(app.projectId);
            await networkPolicyService.reconcileNetworkPolicy(app);
        }
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
