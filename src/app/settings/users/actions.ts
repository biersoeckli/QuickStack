'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { getAdminUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import userService from "@/server/services/user.service";
import { UserEditModel, userEditZodModel } from "@/shared/model/user-edit.model";
import userGroupService from "@/server/services/user-group.service";
import { RoleEditModel, roleEditZodModel } from "@/shared/model/role-edit.model";
import { adminRoleName } from "@/shared/model/role-extended.model.ts";
import restApiKeyService from "@/server/services/rest-api-key.service";
import { RestApiKeyCreateModel, restApiKeyCreateZodModel } from "@/shared/model/rest-api-key.model";
import { CryptoUtils } from "@/server/utils/crypto.utils";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import ssoProviderService from "@/server/services/sso-provider.service";
import { SsoProviderEditModel, ssoProviderEditZodModel } from "@/shared/model/sso-provider.model";
import { FormValidationException } from "@/shared/model/form-validation-exception.model";

export const saveSsoProvider = async (prevState: any, inputData: SsoProviderEditModel) =>
    saveFormAction(inputData, ssoProviderEditZodModel, async (validatedData) => {
        await getAdminUserSession();
        if (validatedData.type === "OIDC" && !validatedData.issuer) {
            throw new FormValidationException("Please correct the errors in the form.", {
                issuer: ["Issuer is required for OIDC."],
            });
        }
        if (validatedData.type === "AZURE_AD" && !validatedData.tenantId) {
            throw new FormValidationException("Please correct the errors in the form.", {
                tenantId: ["Tenant ID is required for Azure AD."],
            });
        }
        await ssoProviderService.save(validatedData);
        revalidatePath("/settings/users");
    });

export const deleteSsoProvider = async (id: string) => simpleAction(async () => {
    await getAdminUserSession();
    await ssoProviderService.deleteById(id);
    revalidatePath("/settings/users");
    return new SuccessActionResult(undefined, "SSO provider deleted");
});

export const saveUser = async (prevState: any, inputData: UserEditModel) =>
    saveFormAction(inputData, userEditZodModel, async (validatedData) => {
        const { email } = await getAdminUserSession();
        if (validatedData.email === email) {
            throw new ServiceException('Please edit your profile in the profile settings');
        }
        if (validatedData.id) {
            const existingUser = await userService.getUserById(validatedData.id);
            const targetGroup = validatedData.userGroupId ? await userGroupService.getById(validatedData.userGroupId) : null;
            if (validatedData.apiOnlyUser && (existingUser.userGroup?.name === adminRoleName || targetGroup?.name === adminRoleName)) {
                throw new ServiceException('You cannot set users with the group "admin" to API-only');
            }
            if (existingUser.apiOnlyUser && !validatedData.apiOnlyUser && !validatedData.newPassword?.trim()) {
                throw new ServiceException('Password is required when converting an API-only user to a regular user');
            }
            if (!existingUser.apiOnlyUser && validatedData.apiOnlyUser) {
                await userService.changePasswordImediately(validatedData.email, CryptoUtils.generateStrongPasswort());
            } else if (!!validatedData.newPassword && !validatedData.apiOnlyUser) {
                await userService.changePasswordImediately(validatedData.email, validatedData.newPassword);
            }
            await userService.updateUser({
                userGroupId: validatedData.userGroupId,
                email: validatedData.email,
                apiOnlyUser: validatedData.apiOnlyUser,
            });
        } else {
            const group = validatedData.userGroupId ? await userGroupService.getById(validatedData.userGroupId) : null;
            if (validatedData.apiOnlyUser && group?.name === adminRoleName) {
                throw new ServiceException('You cannot set users with the group "admin" to API-only');
            }
            if (!validatedData.apiOnlyUser && (!validatedData.newPassword || validatedData.newPassword.split(' ').join('').length === 0)) {
                throw new ServiceException('The password is required');
            }
            await userService.registerUser(validatedData.email, validatedData.apiOnlyUser ? CryptoUtils.generateStrongPasswort() : validatedData.newPassword!, validatedData.userGroupId, validatedData.apiOnlyUser);
        }
        return new SuccessActionResult();
    });

export const adminListApiKeys = async (userId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        return restApiKeyService.listByUserId(userId);
    });

export const adminCreateApiKey = async (prevState: any, inputData: RestApiKeyCreateModel & { userId: string }) =>
    saveFormAction(inputData, restApiKeyCreateZodModel.extend({ userId: z.string().min(1) }), async (validatedData) => {
        await getAdminUserSession();
        const rawApiKey = await restApiKeyService.create(validatedData.userId, validatedData.name, validatedData.expiresAt ?? null);
        return new SuccessActionResult({ rawApiKey }, 'REST API key created successfully.');
    });

export const adminDeleteApiKey = async (userId: string, apiKeyId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await restApiKeyService.deleteByIdForUser(userId, apiKeyId);
        return new SuccessActionResult();
    });

export const saveRole = async (prevState: any, inputData: RoleEditModel) =>
    saveFormAction(inputData, roleEditZodModel, async (validatedData) => {
        await getAdminUserSession();
        await userGroupService.saveWithPermissions(validatedData);
        return new SuccessActionResult();
    });

export const deleteUser = async (userId: string) =>
    simpleAction(async () => {
        const session = await getAdminUserSession();
        const user = await userService.getUserById(userId);
        if (user.email === session.email) {
            throw new ServiceException('You cannot delete your own user');
        }
        if (user.userGroup?.name === adminRoleName) {
            throw new ServiceException('You cannot delete users with the group "admin"');
        }
        await userService.deleteUserById(userId);
        return new SuccessActionResult();
    });

export const assignRoleToUsers = async (userIds: string[], userGroupId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        const users = await userService.getAllUsers();
        for (const user of users) {
            if (userIds.includes(user.id)) {
                user.userGroupId = userGroupId;
            }
        }

        // check if there are any admin users left
        const adminRole = await userGroupService.getOrCreateAdminRole();
        if (!users.some(user => user.userGroupId === adminRole.id)) {
            throw new ServiceException('You cannot perform this group assignment, because there are no admin users left after this operation.');
        }

        // save all users with new role
        const relevantUsers = users.filter(user => userIds.includes(user.id));
        for (const user of relevantUsers) {
            await userGroupService.assignUserToRole(user.id, userGroupId);
        }

        return new SuccessActionResult();
    });

export const deleteRole = async (roleId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await userGroupService.deleteById(roleId);
        return new SuccessActionResult();
    });
