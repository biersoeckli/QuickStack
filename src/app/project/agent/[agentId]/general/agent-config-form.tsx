'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AgentConfigModel, agentConfigZodModel } from "@/shared/model/agent-config.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { saveAgentConfig } from "./actions";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";

interface AgentEnvVarEntry {
    name: string;
    encryptedValue: string;
}

function parseEncryptedEnvVars(raw: string | null): AgentEnvVarEntry[] {
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export default function AgentConfigForm({ agent, readonly }: {
    agent: AgentWithRelationsModel;
    readonly: boolean;
}) {
    const existingEnvVars = parseEncryptedEnvVars(agent.encryptedEnvVars);

    const form = useForm<AgentConfigModel>({
        resolver: zodResolver(agentConfigZodModel),
        defaultValues: {
            image: agent.image || '',
            cpuRequest: agent.cpuRequest || '',
            cpuLimit: agent.cpuLimit || '',
            memoryRequest: agent.memoryRequest || '',
            memoryLimit: agent.memoryLimit || '',
            systemPrompt: agent.systemPrompt || '',
            envVars: existingEnvVars.map((ev) => ({ name: ev.name, value: '' })),
        },
        disabled: readonly,
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "envVars",
    });

    const [state, formAction] = useFormState(
        (state: ServerActionResult<any, any>, payload: AgentConfigModel) =>
            saveAgentConfig(state, payload, agent.id),
        FormUtils.getInitialFormState<typeof agentConfigZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Agent configuration saved.');
        }
        FormUtils.mapValidationErrorsToForm<typeof agentConfigZodModel>(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Configuration</CardTitle>
                            <CardDescription>
                                Configure container image and Kubernetes resource limits for the agent sandbox.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="image"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Custom Image</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Default: ghcr.io/quickstack-dev/agent-sandbox:latest"
                                                {...field}
                                                value={field.value ?? ''}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="cpuRequest"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>CPU Request</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. 100m"
                                                    {...field}
                                                    value={field.value ?? ''}
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
                                            <FormLabel>CPU Limit</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. 500m"
                                                    {...field}
                                                    value={field.value ?? ''}
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
                                            <FormLabel>Memory Request</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. 128Mi"
                                                    {...field}
                                                    value={field.value ?? ''}
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
                                            <FormLabel>Memory Limit</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. 512Mi"
                                                    {...field}
                                                    value={field.value ?? ''}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>System Prompt</CardTitle>
                            <CardDescription>
                                Optional system prompt that will be mounted as a file in the agent sandbox container.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField
                                control={form.control}
                                name="systemPrompt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea
                                                className="min-h-32 font-mono text-sm"
                                                placeholder="You are a helpful AI assistant..."
                                                {...field}
                                                value={field.value ?? ''}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Environment Variables</CardTitle>
                            <CardDescription>
                                Values are encrypted at rest and cannot be viewed after saving. Re-enter values to update them.
                                Names starting with <code className="text-xs bg-muted px-1 rounded">QS_</code> are reserved by QuickStack.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {fields.length === 0 && (
                                <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                                    No environment variables configured.
                                </div>
                            )}
                            {fields.map((field, index) => (
                                <div key={field.id} className="flex items-start gap-2">
                                    <FormField
                                        control={form.control}
                                        name={`envVars.${index}.name`}
                                        render={({ field }) => (
                                            <FormItem className="w-48">
                                                <FormControl>
                                                    <Input
                                                        placeholder="NAME"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`envVars.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <Input
                                                        placeholder="Value"
                                                        type="password"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mt-0"
                                        onClick={() => remove(index)}
                                        disabled={readonly}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {!readonly && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ name: '', value: '' })}
                                >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add Variable
                                </Button>
                            )}
                        </CardContent>
                        {!readonly && (
                            <CardFooter className="gap-4">
                                <SubmitButton>Save Configuration</SubmitButton>
                                {state?.status === 'error' && !state?.errors && (
                                    <p className="text-sm text-red-500">{state.message}</p>
                                )}
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </form>
        </Form>
    );
}
