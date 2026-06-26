'use client';

import { useActionState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import ContainerCommandArgsFields from "@/components/custom/container-command-args-fields";
import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import {
    agentContainerConfigZodModel,
    AgentContainerConfigModel,
} from "@/shared/model/agent-config.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { saveAgentContainerConfig } from "./actions";

function parseContainerArgs(containerArgs: string | null | undefined) {
    if (!containerArgs) {
        return [];
    }
    try {
        const parsed = JSON.parse(containerArgs);
        return Array.isArray(parsed) ? parsed.map((arg: string) => ({ value: arg })) : [];
    } catch {
        return [];
    }
}

export default function AgentContainerConfigCard({ agent, readonly }: {
    agent: AgentWithRelationsModel;
    readonly: boolean;
}) {
    const form = useForm<AgentContainerConfigModel>({
        resolver: zodResolver(agentContainerConfigZodModel),
        defaultValues: {
            containerCommand: agent.containerCommand || '',
            containerArgs: parseContainerArgs(agent.containerArgs),
            warmPoolReplicas: agent.warmPoolReplicas ?? 0,
        },
        disabled: readonly,
    });

    const [state, formAction] = useActionState(
        (state: ServerActionResult<any, any>, payload: AgentContainerConfigModel) =>
            saveAgentContainerConfig(state, payload, agent.id),
        FormUtils.getInitialFormState<typeof agentContainerConfigZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Container configuration saved. Click "Deploy" to apply changes.');
        }
        FormUtils.mapValidationErrorsToForm<typeof agentContainerConfigZodModel>(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <TooltipProvider delayDuration={150}>
                <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Container Configuration</CardTitle>
                            <CardDescription>
                                Configure agent container startup and pre-warmed sandbox capacity.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Runtime</p>
                                    <p className="text-sm text-muted-foreground">
                                        Leave command and arguments empty to use the QuickStack default opencode startup.
                                    </p>
                                </div>
                                <ContainerCommandArgsFields
                                    form={form}
                                    readonly={readonly}
                                    commandHint="Overrides the agent container ENTRYPOINT. Leave command and arguments empty to use the QuickStack default opencode startup."
                                    argsHint="Overrides the agent container CMD. Add one item per argument in the order the process should receive them."
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="warmPoolReplicas"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Warm Pool Replicas</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={10}
                                                {...field}
                                                value={field.value ?? 0}
                                                onChange={(event) => field.onChange(event.target.value === '' ? 0 : Number(event.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
            </TooltipProvider>
        </Form>
    );
}
