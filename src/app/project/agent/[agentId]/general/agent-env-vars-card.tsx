'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { agentEnvVarsZodModel, AgentEnvVarsModel } from "@/shared/model/agent-config.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { saveAgentEnvVars } from "./actions";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";

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

export default function AgentEnvVarsCard({ agent, readonly }: {
    agent: AgentExtendedModel;
    readonly: boolean;
}) {
    const existingEnvVars = parseEncryptedEnvVars(agent.encryptedEnvVars ?? null);

    const form = useForm<AgentEnvVarsModel>({
        resolver: zodResolver(agentEnvVarsZodModel),
        defaultValues: {
            envVars: existingEnvVars.map((ev) => ({ name: ev.name, value: '' })),
        },
        disabled: readonly,
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "envVars",
    });

    const [state, formAction] = useActionState(
        (state: ServerActionResult<any, any>, payload: AgentEnvVarsModel) =>
            saveAgentEnvVars(state, payload, agent.id),
        FormUtils.getInitialFormState<typeof agentEnvVarsZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Environment variables saved. Click "Deploy" to apply changes.');
        }
        FormUtils.mapValidationErrorsToForm<typeof agentEnvVarsZodModel>(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
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
                            <SubmitButton>Save Environment Variables</SubmitButton>
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
