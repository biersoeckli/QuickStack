'use client'

import type { z } from "zod";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/custom/submit-button";
import StorageClassCombobox from "@/components/custom/storage-class-combobox";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { AgentVolumeEditModel, agentVolumeEditZodModel } from "@/shared/model/volume-edit.model";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { saveAgentVolume } from "./actions";

export default function AgentVolumeEditOverlay({
    existingVolume,
    agentId,
    storageClasses
}: {
    existingVolume?: AgentVolumeEditModel & { id?: string; storageClassName: string };
    agentId: string;
    storageClasses: string[];
}) {
    const { closeDialog } = useDialogContext();
    const defaultStorageClassName = existingVolume?.storageClassName || storageClasses[0] || '';

    const form = useForm<z.input<typeof agentVolumeEditZodModel>, unknown, z.output<typeof agentVolumeEditZodModel>>({
        resolver: zodResolver(agentVolumeEditZodModel),
        defaultValues: {
            containerMountPath: existingVolume?.containerMountPath || '',
            size: existingVolume?.size || 1024,
            storageClassName: defaultStorageClassName,
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
    }, [closeDialog, form, state]);

    useEffect(() => {
        if (existingVolume) {
            form.reset({
                containerMountPath: existingVolume.containerMountPath || '',
                size: existingVolume.size || 1024,
                storageClassName: defaultStorageClassName,
            } as AgentVolumeEditModel);
        }
    }, [defaultStorageClassName, existingVolume, form]);

    const storageClassOptions = Array.from(new Set([...storageClasses, existingVolume?.storageClassName].filter(Boolean) as string[]));

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
                action={() => form.handleSubmit((data) => formAction(data))()}
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
                        <FormItem className="flex flex-col">
                            <FormLabel>Storage Class</FormLabel>
                            <FormControl>
                                <StorageClassCombobox
                                    value={field.value}
                                    storageClasses={storageClassOptions}
                                    disabled={!!existingVolume}
                                    onChange={(value) => form.setValue("storageClassName", value)}
                                />
                            </FormControl>
                            <FormDescription>
                                This cannot be changed after creation.
                            </FormDescription>
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
