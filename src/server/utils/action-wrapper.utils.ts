import { ServiceException } from "@/shared/model/service.exception.model";
import { UserGroupExtended, UserSession } from "@/shared/model/sim-session.model";
import { getServerSession } from "next-auth";
import { ZodRawShape, ZodObject, z } from "zod";
import { redirect } from "next/navigation";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { FormValidationException } from "@/shared/model/form-validation-exception.model";
import { authOptions } from "@/server/utils/auth-options";
import { NextResponse } from "next/server";
import userGroupService from "../services/user-group.service";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import { UserGroupUtils } from "../../shared/utils/role.utils";
import {
    ensureAdmin,
    ensureReadApp,
    ensureWriteApp,
    ensureReadAgent,
    ensureWriteAgent,
    RequesterIdentity,
    ensureWriteProjectWorkload,
    ensureReadProjectWorkload
} from "./shared-authorization.utils";
import { WorkloadType, zodWorkloadType } from "@/shared/model/runtime-type.model";

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
    const userSession = session?.user as UserSession;
    return {
        email: userSession?.email as string,
        userId: userSession?.userId as string,
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
    const identity: RequesterIdentity = { type: 'session', session };
    ensureAdmin(identity);
    return identity.session;
}

export async function isAuthorizedForBackups() {
    const session = await getAuthUserSession();
    if (!UserGroupUtils.sessionHasAccessToBackups(session)) {
        console.error('User is not authorized for backups.');
        throw new ServiceException('User is not authorized for this action.');
    }
    return session;
}

/** @deprecated Use isAuthorizedReadForWorkload */
export async function isAuthorizedReadForApp(appId: string) {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureReadApp(identity, appId);
    return identity.session;
}

/** @deprecated Use isAuthorizedReadForWorkload */
export async function isAuthorizedReadForAgent(agentId: string) {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureReadAgent(identity, agentId);
    return identity.session;
}

/** @deprecated Use isAuthorizedWriteForWorkload */
export async function isAuthorizedWriteForApp(appId: string) {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureWriteApp(identity, appId);
    return identity.session;
}

/** @deprecated Use isAuthorizedWriteForWorkload */
export async function isAuthorizedWriteForAgent(agentId: string) {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureWriteAgent(identity, agentId);
    return identity.session;
}

export async function isAuthorizedWriteForWorkload(workloadId: string) {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureWriteProjectWorkload(identity, workloadId);
    return identity.session;
}

export async function isAuthorizedReadForWorkload(workloadId: string) {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureReadProjectWorkload(identity, workloadId);
    return identity.session;
}

export async function safeGetUserPermissionForApp(appId: string) {
    const session = await getUserSession();
    if (!session) {
        return null;
    }
    return UserGroupUtils.getRolePermissionForApp(session, appId);
}

export async function safeGetUserPermissionForAgent(agentId: string) {
    const session = await getUserSession();
    if (!session) {
        return null;
    }
    return UserGroupUtils.getRolePermissionForAgent(session, agentId);
}

export async function workloadExecutor<A, B>(type: WorkloadType, executor: {
    app: () => Promise<A>;
    agent: () => Promise<B>;
}): Promise<A | B> {
    zodWorkloadType.parse(type);
    const execFunc = executor[type];
    if (!execFunc) {
        throw new ServiceException('Invalid workload type.');
    }
    return execFunc();
}

export async function saveFormAction<ReturnType, TInputData, ZodType extends ZodRawShape>(
    inputData: TInputData,
    validationModel: ZodObject<ZodType>,
    func: (validateData: z.infer<ZodObject<ZodType>>) => Promise<ReturnType>,
    redirectOnSuccessPath?: string,
    ignoredFields: (keyof ZodType)[] = []) {
    return simpleAction<ReturnType, z.infer<typeof validationModel>>(async () => {

        // Omit ignored fields from validation model
        const omitBody: Partial<Record<keyof ZodType, true>> = {};
        const schemaFields = new Set(Object.keys(validationModel.shape));
        const allIgnoreFiels = ['createdAt', 'updatedAt', ...ignoredFields];
        allIgnoreFiels.forEach(field => {
            if (schemaFields.has(field as string)) {
                omitBody[field as keyof ZodType] = true;
            }
        });
        const schemaWithoutIgnoredFields = validationModel.omit(omitBody as any);

        const validatedFields = schemaWithoutIgnoredFields.safeParse(inputData);
        if (!validatedFields.success) {
            console.error('Validation failed for input:', inputData, 'with errors:', validatedFields.error.flatten().fieldErrors);
            throw new FormValidationException('Please correct the errors in the form.', validatedFields.error.flatten().fieldErrors);
        }

        if (!validatedFields.data) {
            console.error('No data available after validation of input:', validatedFields.data);
            throw new ServiceException('An unknown error occurred.');
        }
        return await func(validatedFields.data as z.infer<ZodObject<ZodType>>);
    }, redirectOnSuccessPath);
}

type SimpleActionResult<TReturn, TValidation = unknown> =
    TReturn extends ServerActionResult<any, infer D>
    ? ServerActionResult<TValidation, NonNullable<D>>
    : ServerActionResult<TValidation, TReturn>;

export async function simpleAction<ReturnType, ValidationCallbackType = unknown>(
    func: () => Promise<ReturnType>,
    redirectOnSuccessPath?: string): Promise<SimpleActionResult<ReturnType, ValidationCallbackType>> {
    let funcResult: ReturnType;
    try {
        funcResult = await func();
    } catch (ex) {
        if (ex instanceof FormValidationException) {
            return {
                status: 'error',
                message: ex.message,
                errors: ex.errors ?? undefined
            } as any;
        } else if (ex instanceof ServiceException) {
            return {
                status: 'error',
                message: ex.message
            } as any;
        } else {
            console.error(ex)
            return {
                status: 'error',
                message: 'An unknown error occurred.'
            } as any;
        }
    }
    if (redirectOnSuccessPath) redirect(redirectOnSuccessPath);

    if (funcResult instanceof ServerActionResult) {
        return {
            status: funcResult.status,
            message: funcResult.message,
            errors: funcResult.errors,
            data: funcResult.data
        } as any;
    }
    return {
        status: 'success',
        data: funcResult ?? undefined
    } as any;
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
