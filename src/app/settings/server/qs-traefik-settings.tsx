'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { useEffect } from "react";
import { toast } from "sonner";
import { setTraefikIpPropagation } from "./actions";
import { TraefikIpPropagationStatus } from "@/shared/model/traefik-ip-propagation.model";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const traefikSettingsZodModel = z.object({
    enableIpPreservation: z.boolean()
});

type TraefikSettingsModel = z.infer<typeof traefikSettingsZodModel>;

export default function QuickStackTraefikSettings({
    initialStatus
}: {
    initialStatus: TraefikIpPropagationStatus;
}) {
    const currentEnabled = (initialStatus.externalTrafficPolicy ?? 'Cluster') === 'Local';

    const form = useForm<TraefikSettingsModel>({
        resolver: zodResolver(traefikSettingsZodModel),
        defaultValues: {
            enableIpPreservation: currentEnabled,
        }
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>,
        payload: TraefikSettingsModel) =>
        setTraefikIpPropagation(state, payload),
        FormUtils.getInitialFormState<typeof traefikSettingsZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Traefik settings updated successfully.');
        }
        FormUtils.mapValidationErrorsToForm<typeof traefikSettingsZodModel>(state, form)
    }, [state]);

    const readinessText = `${initialStatus.readyReplicas ?? 0}/${initialStatus.replicas ?? 0} pods ready`;
    const lastRestart = initialStatus.restartedAt ? new Date(initialStatus.restartedAt).toLocaleString() : 'Not restarted yet';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Preserve Client IP</CardTitle>
                <CardDescription>
                    Configure how Traefik handles incoming traffic and client IP preservation.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                    return formAction(data);
                })()}>
                    <CardContent className="space-y-4">
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="enableIpPreservation" className="text-base">
                                    Enable IP Preservation
                                </Label>
                                <div className="text-xs text-muted-foreground">{readinessText}</div>
                                <div className="text-xs text-muted-foreground">Last restart: {lastRestart}</div>
                            </div>
                            <Switch
                                id="enableIpPreservation"
                                checked={form.watch('enableIpPreservation')}
                                onCheckedChange={(checked) => form.setValue('enableIpPreservation', checked)}
                            />
                        </div>

                        <div className="text-sm text-muted-foreground space-y-2">
                            <p>
                                Setting <b>externalTrafficPolicy</b> to <b>Local</b> preserves the original client IP but may limit load-balancing flexibility.
                                Only activate this on a single-node cluster.
                            </p>
                            <p>
                                For further details, refer to the <a href="https://kubernetes.io/docs/tutorials/services/source-ip/#source-ip-for-services-with-type-nodeport" target="_blank" className="underline underline-offset-2">Kubernetes documentation</a>.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="gap-4">
                        <SubmitButton>Save</SubmitButton>
                       {state.status !== 'success' && <p className="text-red-500">{state?.message}</p>}
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
