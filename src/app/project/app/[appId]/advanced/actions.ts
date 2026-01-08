'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import appService from "@/server/services/app.service";
import { isAuthorizedWriteForApp, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { BasicAuthEditModel, basicAuthEditZodModel } from "@/shared/model/basic-auth-edit.model";
import { appNetworkPolicy } from "@/shared/model/network-policy.model";
import { HealthCheckModel, healthCheckZodModel } from "./health-check.model";


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
            useNetworkPolicy: useNetworkPolicy
        });
        return new SuccessActionResult(undefined, 'Network policy saved');
    });

export const saveHealthCheck = async (prevState: any, inputData: HealthCheckModel) =>
    saveFormAction(inputData, healthCheckZodModel, async (validatedData) => {
        await isAuthorizedWriteForApp(validatedData.appId);

        const app = await appService.getById(validatedData.appId);

        // Prepare update data
        let updateData: Partial<typeof app> = {
            healthCheckPeriodSeconds: validatedData.periodSeconds ?? 10,
            healthCheckTimeoutSeconds: validatedData.timeoutSeconds ?? 5,
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
