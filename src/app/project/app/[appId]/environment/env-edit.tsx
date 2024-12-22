'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveEnvVariables } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppEnvVariablesModel, appEnvVariablesZodModel } from "@/shared/model/env-edit.model";
import { Textarea } from "@/components/ui/textarea";
import { AppExtendedModel } from "@/shared/model/app-extended.model";


export default function EnvEdit({ app }: {
    app: AppExtendedModel
}) {
    const form = useForm<AppEnvVariablesModel>({
        resolver: zodResolver(appEnvVariablesZodModel),
        defaultValues: app
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppEnvVariablesModel) => saveEnvVariables(state, payload, app.id), FormUtils.getInitialFormState<typeof appEnvVariablesZodModel>());
    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Env Variables Limits Saved', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
        }
        FormUtils.mapValidationErrorsToForm<typeof appEnvVariablesZodModel>(state, form);
    }, [state]);

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>Provide optional environment variables for your application.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">
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
                    </CardContent>
                    <CardFooter>
                        <SubmitButton>Save</SubmitButton>
                    </CardFooter>
                </form>
            </Form >
        </Card >
    </>;
}