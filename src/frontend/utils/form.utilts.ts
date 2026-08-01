import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { FieldPath, UseFormReturn } from "react-hook-form";
import { z, ZodType } from "zod";

export type FormZodErrorValidationCallback<T> = {
    [K in keyof T]?: string[] | undefined;
};

export class FormUtils {

    static mapValidationErrorsToForm<T extends ZodType<any, any, any>, TReturnData = any>(
        state: ServerActionResult<z.infer<T>, TReturnData>,
        form: UseFormReturn<z.input<T>, unknown, z.output<T>>) {

        form.clearErrors();
        if (state && state.errors) {
            for (const [key, value] of Object.entries(state.errors)) {
                if (!value || value.length === 0) {
                    continue;
                }
                form.setError(key as FieldPath<z.input<T>>, { type: 'manual', message: value.join(', ') });
            }
        }
    }

    static getInitialFormState<T extends ZodType<any, any, any>>(): ServerActionResult<z.infer<T>, undefined> {
        return {
            status: '',
            message: undefined
        } as any;
    }
}
