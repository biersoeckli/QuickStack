'use server'

import { AuthFormInputSchema, authFormInputSchemaZod, RegisterFormInputSchema, registgerFormInputSchemaZod } from "@/shared/model/auth-form";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import paramService, { ParamService } from "@/server/services/param.service";
import quickStackService from "@/server/services/qs.service";
import userService from "@/server/services/user.service";
import { saveFormAction } from "@/server/utils/action-wrapper.utils";
import ipAddressFinderAdapter from "@/server/adapter/ip-adress-finder.adapter";
import userGroupService from "@/server/services/user-group.service";


export const registerUser = async (prevState: any, inputData: RegisterFormInputSchema) =>
    saveFormAction(inputData, registgerFormInputSchemaZod, async (validatedData) => {
        const allUsers = await userService.getAllUsers();
        if (allUsers.length !== 0) {
            throw new ServiceException("User registration is currently not possible");
        }
        const adminRole = await userGroupService.getOrCreateAdminRole();
        await userService.registerUser(validatedData.email, validatedData.password, adminRole.id);
        await quickStackService.createOrUpdateCertIssuer(validatedData.email);

        try {
            await paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS, await ipAddressFinderAdapter.getPublicIpOfServer());
        } catch (e) {
            // ignore
            console.error('Failes to evaluate public ip address', e);
        }
        if (validatedData.qsHostname) {
            const url = new URL(validatedData.qsHostname.includes('://') ? validatedData.qsHostname : `https://${validatedData.qsHostname}`);
            await paramService.save({
                name: ParamService.QS_SERVER_HOSTNAME,
                value: url.hostname
            });
            await quickStackService.createOrUpdateIngress(url.hostname);
            return new SuccessActionResult(undefined, 'In a couple seconds QuickStack is available at: ' + url.href);
        }
        return new SuccessActionResult(undefined, 'Successfully registered user');
    });


export const authUser = async (inputData: AuthFormInputSchema) =>
    saveFormAction(inputData, authFormInputSchemaZod, async (validatedData) => {
        const authResult = await userService.authorize({
            username: validatedData.email,
            password: validatedData.password
        });
        if (!authResult) {
            throw new ServiceException('Username or password is incorrect');
        }
        return authResult;
    });