'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveGeneralAppRateLimits } from "./actions";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { Input } from "@/components/ui/input";
import { AppRateLimitsModel, appRateLimitsZodModel } from "@/shared/model/app-rate-limits.model";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { cn } from "@/frontend/utils/utils";


export default function GeneralAppRateLimits({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    const form = useForm<AppRateLimitsModel>({
        resolver: zodResolver(appRateLimitsZodModel),
        defaultValues: app,
        disabled: readonly
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppRateLimitsModel) => saveGeneralAppRateLimits(state, payload, app.id), FormUtils.getInitialFormState<typeof appRateLimitsZodModel>());
    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Rate Limits Saved', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
        }
        FormUtils.mapValidationErrorsToForm<typeof appRateLimitsZodModel>(state, form);
    }, [state]);

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Container Rate Limits</CardTitle>
                <CardDescription>Provide optional rate Limits per running container instance.</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">
                        <div className={cn('grid grid-cols-2 gap-4 ', app.appType !== 'APP' && 'hidden')}>

                            <FormField
                                control={form.control}
                                name="replicas"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Replica Count</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">

                            <FormField
                                control={form.control}
                                name="memoryLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Memory Limit (MB)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="memoryReservation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Memory Reservation (MB)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="cpuLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CPU Limit (m)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="cpuReservation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CPU Reservation (m)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value as string | number | readonly string[] | undefined} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                    {!readonly && <CardFooter className="gap-4">
                        <SubmitButton>Save</SubmitButton>
                        <p className="text-red-500">{state?.message}</p>
                    </CardFooter>}
                </form>
            </Form >
        </Card >

    </>;
}