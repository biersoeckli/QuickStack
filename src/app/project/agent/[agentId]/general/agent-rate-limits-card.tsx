'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { agentRateLimitsZodModel, AgentRateLimitsModel } from "@/shared/model/agent-config.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { saveAgentRateLimits } from "./actions";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";

export default function AgentRateLimitsCard({ agent, readonly }: {
    agent: AgentWithRelationsModel;
    readonly: boolean;
}) {
    const form = useForm<AgentRateLimitsModel>({
        resolver: zodResolver(agentRateLimitsZodModel),
        defaultValues: {
            cpuRequest: agent.cpuRequest ?? undefined,
            cpuLimit: agent.cpuLimit ?? undefined,
            memoryRequest: agent.memoryRequest ?? undefined,
            memoryLimit: agent.memoryLimit ?? undefined,
        },
        disabled: readonly,
    });

    const [state, formAction] = useFormState(
        (state: ServerActionResult<any, any>, payload: AgentRateLimitsModel) =>
            saveAgentRateLimits(state, payload, agent.id),
        FormUtils.getInitialFormState<typeof agentRateLimitsZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Rate limits saved. Click "Deploy" to apply changes.');
        }
        FormUtils.mapValidationErrorsToForm<typeof agentRateLimitsZodModel>(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
                <Card>
                    <CardHeader>
                        <CardTitle>Container Rate Limits</CardTitle>
                        <CardDescription>
                            Configure Kubernetes resource limits per sandbox container instance.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="cpuRequest"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CPU Request (m)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                {...field}
                                                value={field.value as string | number | readonly string[] | undefined}
                                            />
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
                                            <Input
                                                type="number"
                                                {...field}
                                                value={field.value as string | number | readonly string[] | undefined}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="memoryRequest"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Memory Request (MB)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                {...field}
                                                value={field.value as string | number | readonly string[] | undefined}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="memoryLimit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Memory Limit (MB)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                {...field}
                                                value={field.value as string | number | readonly string[] | undefined}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                    {!readonly && (
                        <CardFooter className="gap-4">
                            <SubmitButton>Save</SubmitButton>
                            {state?.status === 'error' && !state?.errors && (
                                <p className="text-sm text-red-500">{state.message}</p>
                            )}
                        </CardFooter>
                    )}
                </Card>
            </form>
        </Form>
    );
}
