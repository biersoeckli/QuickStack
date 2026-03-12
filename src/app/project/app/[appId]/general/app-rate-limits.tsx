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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { cn } from "@/frontend/utils/utils";
import { getRessourceDataApp } from "../overview/actions";
import { PodsResourceInfoModel } from "@/shared/model/pods-resource-info.model";
import { KubeSizeConverter } from "@/shared/utils/kubernetes-size-converter.utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


export default function GeneralAppRateLimits({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    const form = useForm<AppRateLimitsModel>({
        resolver: zodResolver(appRateLimitsZodModel),
        defaultValues: app,
        disabled: readonly
    });

    const [monitoringData, setMonitoringData] = useState<PodsResourceInfoModel | undefined>(undefined);

    useEffect(() => {
        getRessourceDataApp(app.projectId, app.id).then((res) => {
            if (res.status === 'success' && res.data) {
                setMonitoringData(res.data);
            }
        }).catch(() => { /* pod may not be running, silently ignore */ });
    }, [app.id, app.projectId]);

    const suggestedMemoryMb = monitoringData && monitoringData.ramAbsolutBytes
        ? Math.ceil(KubeSizeConverter.fromBytesToMegabytes(monitoringData.ramAbsolutBytes))
        : undefined;
    const suggestedCpuMillicores = monitoringData && monitoringData.cpuAbsolutCores
        ? Math.max(1, Math.round(monitoringData.cpuAbsolutCores * 1000))
        : undefined;

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
                                        {!readonly && suggestedMemoryMb !== undefined && (
                                            <TooltipProvider>
                                                <Tooltip delayDuration={200}>
                                                    <TooltipTrigger asChild>
                                                        <span
                                                            className="inline-flex cursor-pointer items-center rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                                                            onClick={() => form.setValue('memoryReservation', suggestedMemoryMb)}
                                                        >
                                                            ~ {suggestedMemoryMb} MB
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Suggestion based on current pod resource usage</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
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
                                        {!readonly && suggestedCpuMillicores !== undefined && (
                                            <TooltipProvider>
                                                <Tooltip delayDuration={200}>
                                                    <TooltipTrigger asChild>
                                                        <span
                                                            className="inline-flex cursor-pointer items-center rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                                                            onClick={() => form.setValue('cpuReservation', suggestedCpuMillicores)}
                                                        >
                                                            ~ {suggestedCpuMillicores} m
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Suggestion based on current pod resource usage</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
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