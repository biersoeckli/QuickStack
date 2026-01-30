'use client'

import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormField, FormItem, FormControl, FormMessage, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash, Plus } from "lucide-react";
import FormLabelWithQuestion from "@/components/custom/form-label-with-question";
import { useFormState } from "react-dom";
import { saveHealthCheck } from "./actions";
import { useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/custom/submit-button";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { HealthCheckModel, healthCheckZodModel } from "./health-check.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";

export default function HealthCheckSettings({ app, readonly }: { app: AppExtendedModel, readonly: boolean }) {

    const defaultHeaders = app.healthCheckHttpHeadersJson
        ? JSON.parse(app.healthCheckHttpHeadersJson)
        : [];

    const isEnabled = !!(app.healthChechHttpGetPath || app.healthCheckTcpPort);
    const probeType = app.healthChechHttpGetPath ? "HTTP" : app.healthCheckTcpPort ? "TCP" : "HTTP";

    const defaultValues: HealthCheckModel = {
        appId: app.id,
        enabled: isEnabled,
        probeType: probeType as "HTTP" | "TCP",
        path: app.healthChechHttpGetPath || undefined,
        httpPort: app.healthCheckHttpPort || undefined,
        scheme: (app.healthCheckHttpScheme as "HTTP" | "HTTPS") || "HTTP",
        periodSeconds: app.healthCheckPeriodSeconds ?? 15,
        timeoutSeconds: app.healthCheckTimeoutSeconds ?? 5,
        failureThreshold: app.healthCheckFailureThreshold ?? 3,
        headers: defaultHeaders,
        tcpPort: app.healthCheckTcpPort || undefined,
    };

    const form = useForm<HealthCheckModel>({
        resolver: zodResolver(healthCheckZodModel),
        defaultValues,
        disabled: readonly,
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "headers"
    });

    const enabled = form.watch("enabled");
    const probeTypeWatch = form.watch("probeType");

    const [state, formAction] = useFormState(
        (state: ServerActionResult<any, any>, payload: HealthCheckModel) => saveHealthCheck(state, payload),
        FormUtils.getInitialFormState<typeof healthCheckZodModel>()
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Health Check Settings Saved');
        }
        FormUtils.mapValidationErrorsToForm<typeof healthCheckZodModel>(state, form);
    }, [state]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Health Check Settings</CardTitle>
                <CardDescription>
                    Configure healthchecks so that k3s can automatically monitor when your application is fully started up and ready to receive traffic (In kubernetes terms, startup, readiness and liveness probes).
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    formAction(data);
                })()}>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="enabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Enable Health Check</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={readonly}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {enabled && (
                            <>
                                <Tabs value={probeTypeWatch} onValueChange={(value) => form.setValue('probeType', value as "HTTP" | "TCP")} className="w-full">
                                    <TabsList className="mb-2">
                                        <TabsTrigger value="HTTP">HTTP Probe</TabsTrigger>
                                        <TabsTrigger value="TCP">TCP Probe</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="HTTP" className="space-y-4 mt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="path"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabelWithQuestion hint="HTTP path on wich a health check is performed. If the statuscode is in the 200-399 range, the container is considered healthy.">
                                                            HTTP Path
                                                        </FormLabelWithQuestion>
                                                        <FormControl>
                                                            <Input placeholder="/healthz" {...field} value={field.value || ''} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="httpPort"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabelWithQuestion hint="Name or number of the port to access on the container.">
                                                            HTTP Port
                                                        </FormLabelWithQuestion>
                                                        <FormControl>
                                                            <Input type="number" placeholder="80" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value)} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="scheme"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabelWithQuestion hint={
                                                            <div>
                                                                <p>Scheme to use for connecting to the container. Defaults to HTTP.</p>
                                                                <p>Possible enum values:</p>
                                                                <ul className="list-disc pl-4">
                                                                    <li>&quot;HTTP&quot; means that the scheme used will be http://</li>
                                                                    <li>&quot;HTTPS&quot; means that the scheme used will be https://</li>
                                                                </ul>
                                                            </div>
                                                        }>
                                                            HTTP Scheme
                                                        </FormLabelWithQuestion>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select scheme" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="HTTP">HTTP</SelectItem>
                                                                <SelectItem value="HTTPS">HTTPS</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div>
                                            <FormLabelWithQuestion hint={
                                                <div>
                                                    <p>Custom headers to set in the request. HTTP allows repeated headers.</p>
                                                </div>
                                            }>
                                                HTTP Headers
                                            </FormLabelWithQuestion>
                                            <div className="space-y-2 mt-2">
                                                {fields.map((item, index) => (
                                                    <div key={item.id} className="flex gap-2 items-start">
                                                        <FormField
                                                            control={form.control}
                                                            name={`headers.${index}.name`}
                                                            render={({ field }) => (
                                                                <FormItem className="flex-1">
                                                                    {index === 0 && <div className="flex items-center gap-1 mb-1">
                                                                        <FormLabel className="text-xs text-muted-foreground">Name</FormLabel>
                                                                        <FormLabelWithQuestion hint="The header field name. This will be canonicalized upon output, so case-variant names will be understood as the same header.">
                                                                            {''}
                                                                        </FormLabelWithQuestion>
                                                                    </div>}
                                                                    <FormControl>
                                                                        <Input placeholder="X-Custom-Header" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name={`headers.${index}.value`}
                                                            render={({ field }) => (
                                                                <FormItem className="flex-1">
                                                                    {index === 0 && <div className="flex items-center gap-1 mb-1">
                                                                        <FormLabel className="text-xs text-muted-foreground">Value</FormLabel>
                                                                        <FormLabelWithQuestion hint="The header field value">
                                                                            {''}
                                                                        </FormLabelWithQuestion>
                                                                    </div>}
                                                                    <FormControl>
                                                                        <Input placeholder="value" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={readonly}
                                                            onClick={() => remove(index)}
                                                            className={index === 0 ? 'mt-7' : ''}
                                                        >
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={readonly}
                                                    onClick={() => append({ name: '', value: '' })}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Add Header
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="TCP" className="space-y-4 mt-4">
                                        <FormField
                                            control={form.control}
                                            name="tcpPort"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabelWithQuestion hint="Port number to probe using TCP. The probe will attempt to open a TCP connection to this port. If it succeeds, the container is considered healthy.">
                                                        TCP Port
                                                    </FormLabelWithQuestion>
                                                    <FormControl>
                                                        <Input type="number" placeholder="3306" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value)} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </TabsContent>
                                </Tabs>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="periodSeconds"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabelWithQuestion hint="How often (in seconds) to perform the healthcheck. For example every 10 seconds. Minimum value is 1.">
                                                    Check Interval (periodSeconds)
                                                </FormLabelWithQuestion>
                                                <FormControl>
                                                    <Input type="number" {...field} onChange={e => field.onChange(e.target.value)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="timeoutSeconds"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabelWithQuestion hint={
                                                    <div>
                                                        <p>Number of seconds to wait for a connection to complete before timing out. Minimum value is 1.</p>
                                                    </div>
                                                }>
                                                    Check Timeout (timeoutSeconds)
                                                </FormLabelWithQuestion>
                                                <FormControl>
                                                    <Input type="number" {...field} onChange={e => field.onChange(e.target.value)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="failureThreshold"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabelWithQuestion hint="Number of consecutive failures required to mark the container as unhealthy. Minimum value is 1. Example: interval is set to 15 seconds and failureThreshold is set to 4, the container will be marked as unhealthy after 1 minute (15s x 4).">
                                                    Failure Threshold
                                                </FormLabelWithQuestion>
                                                <FormControl>
                                                    <Input type="number" {...field} onChange={e => field.onChange(e.target.value)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter>
                        <SubmitButton>Save</SubmitButton>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
