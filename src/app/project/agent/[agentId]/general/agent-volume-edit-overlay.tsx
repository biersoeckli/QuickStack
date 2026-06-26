'use client'

import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/custom/submit-button";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { AgentVolumeEditModel, agentVolumeEditZodModel, agentStorageClassNameZodModel } from "@/shared/model/volume-edit.model";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { saveAgentVolume } from "./actions";

export default function AgentVolumeEditOverlay({
    existingVolume,
    agentId
}: {
    existingVolume?: AgentVolumeEditModel & { id?: string; storageClassName: string };
    agentId: string;
}) {
    const { closeDialog } = useDialogContext();

    const form = useForm<AgentVolumeEditModel>({
        resolver: zodResolver(agentVolumeEditZodModel),
        defaultValues: {
            containerMountPath: existingVolume?.containerMountPath || '',
            size: existingVolume?.size || 1024,
            storageClassName: existingVolume?.storageClassName || 'longhorn',
        } as AgentVolumeEditModel,
    });

    const [state, formAction] = useActionState(
        (state: ServerActionResult<AgentVolumeEditModel, void>, payload: AgentVolumeEditModel) =>
            saveAgentVolume(state, { ...payload, id: existingVolume?.id }, agentId),
        FormUtils.getInitialFormState<typeof agentVolumeEditZodModel>()
    );

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Volume saved successfully', { description: 'Click "Deploy" to apply the changes.' });
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof agentVolumeEditZodModel>(state, form);
    }, [state]);

    useEffect(() => {
        if (existingVolume) {
            form.reset({
                containerMountPath: existingVolume.containerMountPath || '',
                size: existingVolume.size || 1024,
                storageClassName: existingVolume.storageClassName || 'longhorn',
            } as AgentVolumeEditModel);
        }
    }, [existingVolume, form]);

    const storageClassOptions = agentStorageClassNameZodModel.options;

    return <>
        <DialogHeader>
            <DialogTitle>{existingVolume ? 'Edit Volume' : 'Add Volume'}</DialogTitle>
            <DialogDescription>
                {existingVolume
                    ? 'Update the volume configuration.'
                    : 'Add a persistent volume to this workload.'}
            </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form
                action={(e) => form.handleSubmit((data) => formAction(data))()}
                className="space-y-4"
            >
                <FormField
                    control={form.control}
                    name="containerMountPath"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Mount Path</FormLabel>
                            <FormControl>
                                <Input placeholder="/workspace" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="size"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Size (MB)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="1024" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="storageClassName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Storage Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || 'longhorn'}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select storage class" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {storageClassOptions.map(sc => (
                                        <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {state.status === 'error' && <p className="text-red-400">{state.message}</p>}
                <SubmitButton>Save</SubmitButton>
            </form>
        </Form>
    </>;
}
