'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { getAdminUserSession, getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { ServiceException } from "@/shared/model/service.exception.model";
import userService from "@/server/services/user.service";
import { UserEditModel, userEditZodModel } from "@/shared/model/user-edit.model";
import roleService from "@/server/services/role.service";
import { RoleEditModel, roleEditZodModel } from "@/shared/model/role-edit.model";

export const saveUser = async (prevState: any, inputData: UserEditModel) =>
    saveFormAction(inputData, userEditZodModel, async (validatedData) => {
        const { email } = await getAdminUserSession();
        if (validatedData.email === email) {
            throw new ServiceException('Please edit your profile in the profile settings');
        }
        if (validatedData.id) {
            if (!!validatedData.newPassword) {
                await userService.changePasswordImediately(validatedData.email, validatedData.newPassword);
            }
            await userService.updateUser({
                roleId: validatedData.roleId,
                email: validatedData.email
            });
        } else {
            if (!validatedData.newPassword || validatedData.newPassword.split(' ').join('').length === 0) {
                throw new ServiceException('The password is required');
            }
            await userService.registerUser(validatedData.email, validatedData.newPassword, validatedData.roleId);
        }
        return new SuccessActionResult();
    });

export const saveRole = async (prevState: any, inputData: RoleEditModel) =>
    saveFormAction(inputData, roleEditZodModel, async (validatedData) => {
        await getAdminUserSession();
        await roleService.saveWithPermissions(validatedData);
        return new SuccessActionResult();
    });

export const deleteUser = async (userId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await userService.deleteUserById(userId);
        return new SuccessActionResult();
    });

export const deleteRole = async (roleId: string) =>
    simpleAction(async () => {
        await getAdminUserSession();
        await roleService.deleteById(roleId);
        return new SuccessActionResult();
    });