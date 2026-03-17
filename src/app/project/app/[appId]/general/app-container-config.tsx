'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { saveGeneralAppContainerConfig } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { appContainerConfigZodModel } from "@/shared/model/app-container-config.model";

export type AppContainerConfigInputModel = z.infer<typeof appContainerConfigZodModel>;

function LabelWithHint({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
    return (
        <div className="flex items-center gap-1.5">
            <FormLabel className="m-0">{children}</FormLabel>
            {hint && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        >
                            <HelpCircle className="h-3.5 w-3.5" />
                            <span className="sr-only">More information</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-80">
                        <div className="text-sm leading-relaxed">{hint}</div>
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

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

    const values = form.watch();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Container Configuration</CardTitle>
                <CardDescription>
                    Override image defaults only when your workload needs custom startup behavior or Linux security settings.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <TooltipProvider delayDuration={150}>
                    <form action={(e) => form.handleSubmit((data) => {
                        return formAction(data);
                    })()}>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Runtime</p>
                                    <p className="text-sm text-muted-foreground">
                                        Leave these fields empty to keep the command and arguments from the container image.
                                    </p>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="containerCommand"
                                    render={({ field }) => (
                                        <FormItem>
                                            <LabelWithHint hint="Overrides the image ENTRYPOINT. Leave empty to keep the command defined by the container image.">
                                                Command
                                            </LabelWithHint>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g., /bin/sh or minio"
                                                    {...field}
                                                    value={field.value as string | number | readonly string[] | undefined}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-3">
                                    <LabelWithHint hint="Overrides the image CMD. Add one item per argument in the order the process should receive them.">
                                        Arguments
                                    </LabelWithHint>

                                    <div className="space-y-2">
                                        {fields.length === 0 && (
                                            <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                                                No arguments configured.
                                            </div>
                                        )}

                                        {fields.map((field, index) => (
                                            <div key={field.id} className="flex items-start gap-2">
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
                                            onClick={() => append({ value: '' })}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Argument
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Security Context</p>
                                    <p className="text-sm text-muted-foreground">
                                        Change these values only when your image, mounted volumes, or tooling require specific Linux permissions.
                                    </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <FormField
                                        control={form.control}
                                        name="securityContextRunAsUser"
                                        render={({ field }) => (
                                            <FormItem>
                                                <LabelWithHint hint="Linux user ID for the main container process. Maps to runAsUser in the Kubernetes securityContext.">
                                                    Run As User
                                                </LabelWithHint>
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
                                                <LabelWithHint hint="Linux group ID for the main container process. Maps to runAsGroup in the Kubernetes securityContext.">
                                                    Run As Group
                                                </LabelWithHint>
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
                                                <LabelWithHint hint="Supplemental group ID applied at pod level so mounted volumes can be owned and writable by that group. Maps to fsGroup in the Kubernetes securityContext.">
                                                    FS Group
                                                </LabelWithHint>
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
                                        <FormItem className="space-y-3 rounded-md border p-4">
                                            <div className="flex items-start gap-4">
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value ?? false}
                                                        onCheckedChange={field.onChange}
                                                        disabled={readonly}
                                                    />
                                                </FormControl>
                                                <div className="space-y-3 pt-0.5">
                                                    <LabelWithHint
                                                        hint={(
                                                            <>
                                                                <p>
                                                                    Removes most container isolation. The container gets all Linux capabilities,
                                                                    access to host devices, and can interact with the node almost like a root
                                                                    process on the host.
                                                                </p>
                                                                <p className="mt-2">
                                                                    If the container is compromised, it can affect the Kubernetes node and
                                                                    other workloads. Use this only for workloads such as Docker-in-Docker
                                                                    or low-level system tooling.
                                                                </p>
                                                            </>
                                                        )}
                                                    >
                                                        Privileged Mode
                                                    </LabelWithHint>

                                                    {values.securityContextPrivileged && <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                                                        <AlertDescription>
                                                            Enable this only if you fully understand the implications and risks.
                                                        </AlertDescription>
                                                    </Alert>}
                                                </div>

                                            </div>
                                            <FormMessage />
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
                </TooltipProvider>
            </Form>
        </Card>
    );
}
