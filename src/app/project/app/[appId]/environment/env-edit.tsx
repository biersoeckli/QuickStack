'use client';

import type { z } from "zod";
import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveEnvVariables } from "./actions";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { AppEnvVariablesModel, appEnvVariablesZodModel } from "@/shared/model/env-edit.model";
import { Textarea } from "@/components/ui/textarea";
import { AppExtendedModel } from "@/shared/model/app-extended.model";


export default function EnvEdit({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    const form = useForm<z.input<typeof appEnvVariablesZodModel>, unknown, z.output<typeof appEnvVariablesZodModel>>({
        resolver: zodResolver(appEnvVariablesZodModel),
        defaultValues: app,
        disabled: readonly,
    });

    const [state, formAction] = useActionState((state: ServerActionResult<any, any>, payload: AppEnvVariablesModel) => saveEnvVariables(state, payload, app.id), FormUtils.getInitialFormState<typeof appEnvVariablesZodModel>());
    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Environment Settings Saved', {
                description: "Click \"deploy\" to apply the changes to your app. Build arguments apply on the next build.",
            });
        }
        FormUtils.mapValidationErrorsToForm<typeof appEnvVariablesZodModel>(state, form);
    }, [form, state]);

    const buildArgsEnabled = app.appType === 'APP' && app.buildMethod === 'DOCKERFILE';

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>
                    Provide optional environment variables for your application.
                    {app.appType !== 'APP' && <div className="text-sm text-red-500 pt-2">You should not change ENV variables for databases.</div>}

                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={() => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="envVars"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Env Variables</FormLabel>
                                    <FormControl>
                                        <Textarea className="h-96" placeholder="NAME=VALUE..." {...field} value={field.value} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="buildArgs"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Build Arguments</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            className="h-48"
                                            placeholder="NAME=VALUE..."
                                            {...field}
                                            value={field.value}
                                            disabled={readonly || !buildArgsEnabled}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Passed to Docker as build arguments (KEY=VALUE) while building the image only.
                                        They are not available at runtime, are not secret, and apply on the next build.
                                    </FormDescription>
                                    {!buildArgsEnabled && (
                                        <FormDescription>
                                            Only available for Apps that build with a Dockerfile.
                                        </FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    {!readonly && <CardFooter>
                        <SubmitButton>Save</SubmitButton>
                    </CardFooter>}
                </form>
            </Form >
        </Card >
    </>;
}
