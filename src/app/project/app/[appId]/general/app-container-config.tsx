'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { saveGeneralAppContainerConfig } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Trash2, Plus } from "lucide-react";
import { z } from "zod";

// Zod schema for the container config form
const appContainerConfigZodModel = z.object({
    containerCommand: z.string().trim().nullish(),
    containerArgs: z.array(z.object({
        value: z.string().trim()
    })).optional(),
});

export type AppContainerConfigInputModel = z.infer<typeof appContainerConfigZodModel>;

export default function GeneralAppContainerConfig({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    // Parse containerArgs from JSON string to array
    const initialArgs = app.containerArgs
        ? JSON.parse(app.containerArgs).map((arg: string) => ({ value: arg }))
        : [];

    const form = useForm<AppContainerConfigInputModel>({
        resolver: zodResolver(appContainerConfigZodModel),
        defaultValues: {
            containerCommand: app.containerCommand || '',
            containerArgs: initialArgs,
        },
        disabled: readonly,
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "containerArgs",
    });

    const [state, formAction] = useFormState(
        (state: ServerActionResult<any, any>, payload: AppContainerConfigInputModel) =>
            saveGeneralAppContainerConfig(state, payload, app.id),
        FormUtils.getInitialFormState<typeof appContainerConfigZodModel>()
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Container Configuration Saved', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
        }
        FormUtils.mapValidationErrorsToForm<typeof appContainerConfigZodModel>(state, form)
    }, [state]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Container Configuration</CardTitle>
                <CardDescription>
                    Override the container&apos;s command and arguments. Leave empty to use the image defaults.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="containerCommand"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Command (optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., /bin/sh or minio"
                                            {...field}
                                            value={field.value as string | number | readonly string[] | undefined}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Override the container&apos;s ENTRYPOINT.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2">
                            <FormLabel>Arguments (optional)</FormLabel>
                            <FormDescription className="mb-3">
                                Override the container&apos;s CMD. Each argument should be a separate item.
                            </FormDescription>

                            <div className="space-y-2">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-start">
                                        <FormField
                                            control={form.control}
                                            name={`containerArgs.${index}.value`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input
                                                            placeholder={`Argument ${index + 1}`}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="mt-0"
                                            onClick={() => remove(index)}
                                            disabled={readonly}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {!readonly && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => append({ value: '' })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Argument
                                </Button>
                            )}
                        </div>
                    </CardContent>
                    {!readonly && (
                        <CardFooter className="gap-4">
                            <SubmitButton>Save</SubmitButton>
                            <p className="text-red-500">{state?.message}</p>
                        </CardFooter>
                    )}
                </form>
            </Form>
        </Card>
    );
}
