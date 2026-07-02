'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { QsIngressSettingsModel, qsIngressSettingsZodModel } from "@/shared/model/qs-settings.model";
import { updateIngressSettings } from "./actions";
import CheckboxFormField from "@/components/custom/checkbox-form-field";

export default function QuickStackIngressSettings({
    serverUrl,
    disableNodePortAccess
}: {
    serverUrl: string;
    disableNodePortAccess: boolean;
}) {
    const form = useForm<QsIngressSettingsModel>({
        resolver: zodResolver(qsIngressSettingsZodModel),
        defaultValues: {
            serverUrl,
            disableNodePortAccess: !disableNodePortAccess
        }
    });

    const [state, formAction] = useActionState((state: ServerActionResult<any, any>, payload: QsIngressSettingsModel) =>
        updateIngressSettings(state, payload), FormUtils.getInitialFormState<typeof qsIngressSettingsZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Settings updated successfully. It may take a few seconds for the changes to take effect.');
        }
        FormUtils.mapValidationErrorsToForm<typeof qsIngressSettingsZodModel>(state, form)
    }, [state]);

    const sourceTypeField = form.watch();
    return <>
        <Card>
            <CardHeader>
                <CardTitle>Panel Domain</CardTitle>
                <CardDescription>Change the domain settings for your QuickStack instance.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction({
                        ...data,
                        disableNodePortAccess: !data.disableNodePortAccess
                    });
                })()}>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="serverUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Domain</FormLabel>
                                    <FormControl>
                                        <Input  {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Make sure the DNS settings of the domain are correctly configured to point to the server IP address.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <CheckboxFormField
                            form={form}
                            name="disableNodePortAccess"
                            label="Serve QuickStack over IP Address and Port 30000"
                        />

                    </CardContent>
                    <CardFooter className="gap-4">
                        <SubmitButton>Save</SubmitButton>
                        <p className="text-red-500">{state?.message}</p>
                    </CardFooter>
                </form>
            </Form >
        </Card >

    </>;
}