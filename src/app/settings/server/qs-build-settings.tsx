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
import { BuildSettingsModel, buildSettingsZodModel } from "@/shared/model/build-settings.model";
import { useEffect } from "react";
import { toast } from "sonner";
import { saveBuildSettings } from "./actions";
import { NodeInfoModel } from "@/shared/model/node-info.model";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Constants } from "@/shared/utils/constants";

export default function QsBuildSettings({
    buildSettings,
    nodes,
}: {
    buildSettings: BuildSettingsModel;
    nodes: NodeInfoModel[];
}) {
    const form = useForm<BuildSettingsModel>({
        resolver: zodResolver(buildSettingsZodModel),
        defaultValues: {
            ...buildSettings,
            buildNode: buildSettings.buildNode || Constants.BUILD_AUTO_NODE_VALUE,
        },
    });

    const [state, formAction] = useFormState(
        (state: ServerActionResult<any, any>, payload: BuildSettingsModel) => saveBuildSettings(state, payload),
        FormUtils.getInitialFormState<typeof buildSettingsZodModel>()
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Build settings saved.');
        }
        FormUtils.mapValidationErrorsToForm<typeof buildSettingsZodModel>(state, form);
    }, [state]);

    const watchedBuildNode = form.watch('buildNode');
    const isK3sNative = watchedBuildNode === Constants.BUILD_NODE_K3S_NATIVE_VALUE;
    const showReservationAlert = !buildSettings.memoryReservation || !buildSettings.cpuReservation;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Build Container Settings</CardTitle>
                <CardDescription>
                    Configure global resource limits and node placement for all build containers.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    const payload = {
                        ...data,
                        buildNode: data.buildNode === Constants.BUILD_AUTO_NODE_VALUE || data.buildNode === '' ? null : data.buildNode,
                    };
                    return formAction(payload);
                })()}>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="concurrencyLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Build Concurrency Limit</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value as string | number | undefined ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="buildNode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Build Node (optional)</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || Constants.BUILD_AUTO_NODE_VALUE}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Auto (node with most available resources)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value={Constants.BUILD_AUTO_NODE_VALUE}>
                                                    Auto (node with most available resources)
                                                </SelectItem>
                                                <SelectItem value={Constants.BUILD_NODE_K3S_NATIVE_VALUE}>
                                                    k3s native
                                                </SelectItem>
                                                {nodes.map((node) => (
                                                    <SelectItem
                                                        key={node.name}
                                                        value={node.name}
                                                        disabled={!node.schedulable}
                                                    >
                                                        {node.name}{!node.schedulable ? ' (not schedulable)' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {isK3sNative && showReservationAlert && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Reservations not configured</AlertTitle>
                                <AlertDescription>
                                    No CPU and/or memory reservations are set. Setting them is recommended for optimal build container scheduling.
                                </AlertDescription>
                            </Alert>
                        )}

                        {isK3sNative && <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="memoryLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Memory Limit (MB)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value as string | number | undefined ?? ''} />
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
                                            <Input type="number" {...field} value={field.value as string | number | undefined ?? ''} />
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
                                            <Input type="number" {...field} value={field.value as string | number | undefined ?? ''} />
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
                                            <Input type="number" {...field} value={field.value as string | number | undefined ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>}
                    </CardContent>
                    <CardFooter className="gap-4">
                        <SubmitButton>Save</SubmitButton>
                        <p className="text-red-500">{state?.message}</p>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
