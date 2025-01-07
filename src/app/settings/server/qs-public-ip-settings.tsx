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
import { useEffect } from "react";
import { toast } from "sonner";
import { updatePublicIpv4Settings, updatePublicIpv4SettingsAutomatically } from "./actions";
import { QsPublicIpv4SettingsModel, qsPublicIpv4SettingsZodModel } from "@/shared/model/qs-public-ipv4-settings.model";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";

export default function QuickStackPublicIpSettings({
    publicIpv4,
}: {
    publicIpv4?: string;
}) {
    const form = useForm<QsPublicIpv4SettingsModel>({
        resolver: zodResolver(qsPublicIpv4SettingsZodModel),
        defaultValues: {
            publicIpv4,
        }
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: QsPublicIpv4SettingsModel) =>
        updatePublicIpv4Settings(state, payload), FormUtils.getInitialFormState<typeof qsPublicIpv4SettingsZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Settings updated successfully.');
        }
        FormUtils.mapValidationErrorsToForm<typeof qsPublicIpv4SettingsZodModel>(state, form)
    }, [state]);

    useEffect(() => {
        form.reset({ publicIpv4 });
    }, [publicIpv4]);

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Main Public IPv4 Address</CardTitle>
                <CardDescription>Your main public IPv4 address is set automatically during the QuickStack setup.
                    If you wish to change it, you can do so here.
                    Make sure that your new IP is assigned to the server and reachable from the internet.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="publicIpv4"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>IP Address</FormLabel>
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
                        <Button onClick={() => Toast.fromAction(() => updatePublicIpv4SettingsAutomatically())} type="button" variant='ghost'>Evaluate automatically</Button>
                        <p className="text-red-500">{state?.message}</p>
                    </CardFooter>
                </form>
            </Form >
        </Card >

    </>;
}