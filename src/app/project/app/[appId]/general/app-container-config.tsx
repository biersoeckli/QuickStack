'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { appContainerConfigZodModel } from "@/shared/model/app-container-config.model";
import FormLabelWithQuestion from "@/components/custom/form-label-with-question";

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
            securityContextRunAsUser: app.securityContextRunAsUser ?? undefined,
            securityContextRunAsGroup: app.securityContextRunAsGroup ?? undefined,
            securityContextFsGroup: app.securityContextFsGroup ?? undefined,
            securityContextPrivileged: app.securityContextPrivileged ?? false,
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

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium">Security Context (optional)</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Use this when your app requires specific user/group permissions or needs to run with a specific filesystem group for volume access.
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="securityContextRunAsUser"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabelWithQuestion hint="The UID to run the container process as. Corresponds to runAsUser in the Kubernetes pod securityContext.">
                                                Run As User
                                            </FormLabelWithQuestion>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g., 1001"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="securityContextRunAsGroup"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabelWithQuestion hint="The GID to run the container process as. Corresponds to runAsGroup in the Kubernetes pod securityContext.">
                                                Run As Group
                                            </FormLabelWithQuestion>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g., 1001"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="securityContextFsGroup"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabelWithQuestion hint="A special supplemental group applied to all containers in the pod. Volume ownership will be set to this GID. Corresponds to fsGroup in the Kubernetes pod securityContext.">
                                                FS Group
                                            </FormLabelWithQuestion>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="e.g., 1001"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                    onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="securityContextPrivileged"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                disabled={readonly}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>Privileged Mode</FormLabel>
                                            <FormDescription>
                                                Run this container in privileged mode. This grants full access to the host&apos;s devices and kernel capabilities. Required for Docker-in-Docker (DinD) workloads such as CI/CD runners.
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />
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
