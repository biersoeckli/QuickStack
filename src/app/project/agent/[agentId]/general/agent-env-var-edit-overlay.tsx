'use client';

import type { z } from "zod";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/custom/submit-button";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AgentEnvVarEditModel, agentEnvVarEditZodModel } from "@/shared/model/agent-config.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { saveAgentEnvVar } from "./actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function AgentEnvVarEditOverlay({ agentId, existingName }: { agentId: string; existingName?: string }) {
    const { closeDialog } = useDialogContext();
    const form = useForm<z.input<typeof agentEnvVarEditZodModel>, unknown, z.output<typeof agentEnvVarEditZodModel>>({
        resolver: zodResolver(agentEnvVarEditZodModel),
        defaultValues: { name: existingName ?? '', value: '', originalName: existingName },
    });
    const [state, formAction] = useActionState(
        (state: ServerActionResult<any, any>, payload: AgentEnvVarEditModel) => saveAgentEnvVar(state, payload, agentId),
        FormUtils.getInitialFormState<typeof agentEnvVarEditZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Environment variable saved.', { description: 'Click "Deploy" to apply changes.' });
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof agentEnvVarEditZodModel>(state, form);
    }, [closeDialog, form, state]);

    return (
        <Form {...form}>
            <form action={() => form.handleSubmit((data) => formAction(data))()}>
                <DialogHeader>
                    <DialogTitle>{existingName ? 'Edit Environment Variable' : 'Create Environment Variable'}</DialogTitle>
                    <DialogDescription>
                        {existingName
                            ? 'Update env value here to override existing value. For security reasons, existing value is not shown.'
                            : 'Values are encrypted and cannot be shown after saving.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Key</FormLabel>
                            <FormControl><Input placeholder="API_KEY" disabled={Boolean(existingName)} {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="value" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Value</FormLabel>
                            <FormControl><Input type="password" autoComplete="new-password" placeholder="Enter value" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <p className="text-red-500">{state.status === 'error' && !state.errors ? state.message : ''}</p>
                </div>
                <DialogFooter><SubmitButton>Save</SubmitButton></DialogFooter>
            </form>
        </Form>
    );
}
