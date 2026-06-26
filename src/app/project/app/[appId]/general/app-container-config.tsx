'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveGeneralAppContainerConfig } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { z } from "zod";
import { appContainerConfigZodModel } from "@/shared/model/app-container-config.model";
import ContainerCommandArgsFields, { LabelWithHint } from "@/components/custom/container-command-args-fields";

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

    const [state, formAction] = useActionState(
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

                                <ContainerCommandArgsFields form={form} readonly={readonly} />
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
