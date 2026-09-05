'use client';

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/custom/submit-button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { RenameAgentModel, renameAgentZodModel } from "@/shared/model/rename-agent.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { renameAgent } from "./actions";
import { Agent } from "@prisma/client";

export function RenameAgentDialog({ agent }: { agent: AgentExtendedModel }) {
    const { closeDialog } = useDialogContext();
    const router = useRouter();
    const form = useForm<z.input<typeof renameAgentZodModel>, unknown, z.output<typeof renameAgentZodModel>>({
        resolver: zodResolver(renameAgentZodModel),
        defaultValues: { name: agent.name },
    });
    const [state, formAction] = useActionState((state: ServerActionResult<RenameAgentModel, Agent>, payload: RenameAgentModel) => renameAgent(state, payload, agent.id),
        FormUtils.getInitialFormState<typeof renameAgentZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Agent renamed successfully.');
            closeDialog();
            router.refresh();
        }
        FormUtils.mapValidationErrorsToForm<typeof renameAgentZodModel>(state, form);
    }, [closeDialog, form, router, state]);

    const submit = () => {
        form.handleSubmit((data) => formAction(data))();
    };

    return (
        <Form {...form}>
            <form action={submit}>
                <DialogHeader>
                    <DialogTitle>Rename Agent</DialogTitle>
                    <DialogDescription>Choose a new display name for this agent.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl><Input autoFocus {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <p className="text-red-500">{state.status === 'error' && !state.errors ? state.message : ''}</p>
                </div>
                <DialogFooter>
                    <SubmitButton>Rename</SubmitButton>
                    <Button type="button" variant="outline" onClick={() => closeDialog()}>Cancel</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}
