import { ServiceException } from "@/shared/model/service.exception.model";
import {  UserGroupExtended, UserSession } from "@/shared/model/sim-session.model";
import { getServerSession } from "next-auth";
import { ZodRawShape, ZodObject, objectUtil, baseObjectOutputType, z, ZodType } from "zod";
import { redirect } from "next/navigation";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { FormValidationException } from "@/shared/model/form-validation-exception.model";
import { authOptions } from "@/server/utils/auth-options";
import { NextResponse } from "next/server";
import userGroupService from "../services/user-group.service";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { UserGroupUtils } from "../../shared/utils/role.utils";

/**
 * THIS FUNCTION RETURNS NULL IF NO USER IS LOGGED IN
 * use getAuthUserSession() if you want to throw an error if no user is logged in
 */
export async function getUserSession(): Promise<UserSession | null> {
    const session = await getServerSession(authOptions);
    if (!session) {
        return null;
    }
    let userGroup: UserGroupExtended | null = null;
    if (!!session?.user?.email) {
        userGroup = await userGroupService.getRoleByUserMail(session.user.email);
    }
    return {
        email: session?.user?.email as string,
        userGroup: userGroup ?? undefined,
    };
}

export async function getAuthUserSession(): Promise<UserSession> {
    const session = await getUserSession();
    if (!session) {
        console.error('User is not authenticated.');
        redirect('/auth');
    }
    return session;
}

export async function getAdminUserSession(): Promise<UserSession> {
    const session = await getAuthUserSession();
    if (!UserGroupUtils.isAdmin(session)) {
        console.error('User is not admin.');
        throw new ServiceException('User is not authorized for this action.');
    }
    return session;
}

export async function isAuthorizedForBackups() {
    const session = await getAuthUserSession();
    if (!UserGroupUtils.sessionHasAccessToBackups(session)) {
        console.error('User is not authorized for backups.');
        throw new ServiceException('User is not authorized for this action.');
    }
    return session;
}

export async function isAuthorizedReadForApp(appId: string) {
    const session = await getAuthUserSession();
    if (UserGroupUtils.isAdmin(session)) {
        return session;
    }
    if (!session.userGroup) {
        console.error('User is not authorized for app: ' + appId);
        throw new ServiceException('User is not authorized for this action.');
    }
    const roleHasReadAccessForApp = UserGroupUtils.sessionHasReadAccessForApp(session, appId);
    if (!roleHasReadAccessForApp) {
        console.error('User is not authorized for app: ' + appId);
        throw new ServiceException('User is not authorized for this action.');
    }
    return session;
}

export async function isAuthorizedWriteForApp(appId: string) {
    const session = await getAuthUserSession();
    if (UserGroupUtils.isAdmin(session)) {
        return session;
    }
    if (!session.userGroup) {
        console.error('User is not authorized for app: ' + appId);
        throw new ServiceException('User is not authorized for this action.');
    }
    const roleHasReadAccessForApp = UserGroupUtils.sessionHasWriteAccessForApp(session, appId);
    if (!roleHasReadAccessForApp) {
        console.error('User is not authorized for app: ' + appId);
        throw new ServiceException('User is not authorized for this action.');
    }
    return session;
}

export async function safeGetUserPermissionForApp(appId: string) {
    const session = await getUserSession();
    if (!session) {
        return null;
    }
    return UserGroupUtils.getRolePermissionForApp(session, appId);
}

export async function saveFormAction<ReturnType, TInputData, ZodType extends ZodRawShape>(
    inputData: TInputData,
    validationModel: ZodObject<ZodType>,
    func: (validateData: { [k in keyof objectUtil.addQuestionMarks<baseObjectOutputType<ZodType>, any>]: objectUtil.addQuestionMarks<baseObjectOutputType<ZodType>, any>[k]; }) => Promise<ReturnType>,
    redirectOnSuccessPath?: string,
    ignoredFields: (keyof ZodType)[] = []) {
    return simpleAction<ReturnType, z.infer<typeof validationModel>>(async () => {

        // Omit ignored fields from validation model
        const omitBody = {};
        const allIgnoreFiels = ['createdAt', 'updatedAt', ...ignoredFields];
        allIgnoreFiels.forEach(field => (omitBody as any)[field] = true);
        const schemaWithoutIgnoredFields = validationModel.omit(omitBody);

        const validatedFields = schemaWithoutIgnoredFields.safeParse(inputData);
        if (!validatedFields.success) {
            console.error('Validation failed for input:', inputData, 'with errors:', validatedFields.error.flatten().fieldErrors);
            throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
        }

        if (!validatedFields.data) {
            console.error('No data available after validation of input:', validatedFields.data);
            throw new ServiceException('An unknown error occurred.');
        }
        return await func(validatedFields.data);
    }, redirectOnSuccessPath);
}

export async function simpleAction<ReturnType, ValidationCallbackType>(
    func: () => Promise<ReturnType>,
    redirectOnSuccessPath?: string) {
    let funcResult: ReturnType;
    try {
        funcResult = await func();
    } catch (ex) {
        if (ex instanceof FormValidationException) {
            return {
                status: 'error',
                message: ex.message,
                errors: ex.errors ?? undefined
            } as ServerActionResult<ValidationCallbackType, ReturnType>;
        } else if (ex instanceof ServiceException) {
            return {
                status: 'error',
                message: ex.message
            } as ServerActionResult<ValidationCallbackType, ReturnType>;
        } else {
            console.error(ex)
            return {
                status: 'error',
                message: 'An unknown error occurred.'
            } as ServerActionResult<ValidationCallbackType, ReturnType>;
        }
    }
    if (redirectOnSuccessPath) redirect(redirectOnSuccessPath);

    if (funcResult instanceof ServerActionResult) {
        return {
            status: funcResult.status,
            message: funcResult.message,
            errors: funcResult.errors,
            data: funcResult.data
        } as ServerActionResult<ValidationCallbackType, typeof funcResult.data>;
    }
    return {
        status: 'success',
        data: funcResult ?? undefined
    } as ServerActionResult<ValidationCallbackType, ReturnType>;
}

/**
 * Wrapper for server actions that handle file uploads via FormData
 * Extracts file from FormData and passes it to the handler function
 */
export async function fileUploadAction<ReturnType>(
    formData: FormData,
    fileFieldName: string,
    func: (file: File) => Promise<ReturnType>,
    redirectOnSuccessPath?: string) {
    let funcResult: ReturnType;
    try {
        const file = formData.get(fileFieldName) as File;
        if (!file || !file.size) {
            throw new ServiceException('No file uploaded or file is empty.');
        }
        funcResult = await func(file);
    } catch (ex) {
        if (ex instanceof ServiceException) {
            return {
                status: 'error',
                message: ex.message
            } as ServerActionResult<any, ReturnType>;
        } else {
            console.error(ex);
            return {
                status: 'error',
                message: 'An unknown error occurred during file upload.'
            } as ServerActionResult<any, ReturnType>;
        }
    }
    if (redirectOnSuccessPath) redirect(redirectOnSuccessPath);

    if (funcResult instanceof ServerActionResult) {
        return {
            status: funcResult.status,
            message: funcResult.message,
            errors: funcResult.errors,
            data: funcResult.data
        } as ServerActionResult<any, typeof funcResult.data>;
    }
    return {
        status: 'success',
        data: funcResult ?? undefined
    } as ServerActionResult<any, ReturnType>;
}



export async function simpleRoute<ReturnType>(
    func: () => Promise<ReturnType>) {
    let funcResult: ReturnType;
    try {
        funcResult = await func();
    } catch (ex) {
        if (ex instanceof FormValidationException) {
            return NextResponse.json({
                status: 'error',
                message: ex.message
            });
        } else if (ex instanceof ServiceException) {
            return NextResponse.json({
                status: 'error',
                message: ex.message
            });
        } else {
            console.error(ex)
            return NextResponse.json({
                status: 'error',
                message: 'An unknown error occurred.'
            });
        }
    }
    return funcResult;
}