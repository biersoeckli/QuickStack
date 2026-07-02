'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateLetsEncryptSettings } from "./actions";
import { QsLetsEncryptSettingsModel, qsLetsEncryptSettingsZodModel } from "@/shared/model/qs-letsencrypt-settings.model";

export default function QuickStackLetsEncryptSettings({
    letsEncryptMail,
}: {
    letsEncryptMail: string;
}) {
    const form = useForm<QsLetsEncryptSettingsModel>({
        resolver: zodResolver(qsLetsEncryptSettingsZodModel),
        defaultValues: {
            letsEncryptMail,
        }
    });

    const [state, formAction] = useActionState((state: ServerActionResult<any, any>, payload: QsLetsEncryptSettingsModel) =>
        updateLetsEncryptSettings(state, payload), FormUtils.getInitialFormState<typeof qsLetsEncryptSettingsZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Settings updated successfully. It may take a few seconds for the changes to take effect.');
        }
        FormUtils.mapValidationErrorsToForm<typeof qsLetsEncryptSettingsZodModel>(state, form)
    }, [state]);

    const sourceTypeField = form.watch();
    return <>
        <Card>
            <CardHeader>
                <CardTitle>SSL Certificates</CardTitle>
                <CardDescription>To issue SSL Certificates to your Apps, provide your Let&apos;s Encrypt email address.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="letsEncryptMail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Let&apos;s Encrypt Email</FormLabel>
                                    <FormControl>
                                        <Input  {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
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
