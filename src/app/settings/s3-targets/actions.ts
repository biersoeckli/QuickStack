'use server'

import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import { getAuthUserSession, saveFormAction, simpleAction } from "@/server/utils/action-wrapper.utils";
import { S3TargetEditModel, s3TargetEditZodModel } from "@/shared/model/s3-target-edit.model";
import s3TargetService from "@/server/services/s3-target.service";

export const saveS3Target = async (prevState: any, inputData: S3TargetEditModel) =>
    saveFormAction(inputData, s3TargetEditZodModel, async (validatedData) => {
        await getAuthUserSession();
        await s3TargetService.save({
            ...validatedData,
            id: validatedData.id ?? undefined,
        });
    });

export const deleteS3Target = async (s3TargetId: string) =>
    simpleAction(async () => {
        await getAuthUserSession();
        await s3TargetService.deleteById(s3TargetId);
        return new SuccessActionResult(undefined, 'Successfully deleted S3 Target');
    });