'use client';

import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { agentSystemPromptZodModel, AgentSystemPromptModel } from "@/shared/model/agent-config.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { saveAgentSystemPrompt } from "./actions";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";

export default function AgentSystemPromptCard({ agent, readonly }: {
    agent: AgentWithRelationsModel;
    readonly: boolean;
}) {
    const form = useForm<AgentSystemPromptModel>({
        resolver: zodResolver(agentSystemPromptZodModel),
        defaultValues: {
            systemPrompt: agent.systemPrompt || '',
        },
        disabled: readonly,
    });

    const [state, formAction] = useActionState(
        (state: ServerActionResult<any, any>, payload: AgentSystemPromptModel) =>
            saveAgentSystemPrompt(state, payload, agent.id),
        FormUtils.getInitialFormState<typeof agentSystemPromptZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('System prompt saved. Click "Deploy" to apply changes.');
        }
        FormUtils.mapValidationErrorsToForm<typeof agentSystemPromptZodModel>(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
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
                    {!readonly && (
                        <CardFooter className="gap-4">
                            <SubmitButton>Save System Prompt</SubmitButton>
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
