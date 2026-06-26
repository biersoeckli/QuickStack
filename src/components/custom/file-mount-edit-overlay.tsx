'use client'

import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/custom/submit-button";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { FileMountEditModel, fileMountEditZodModel } from "@/shared/model/file-mount-edit.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { saveFileMount } from "@/app/project/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function FileMountEditOverlay({
    existingFileMount,
    workloadId,
    workloadType,
}: {
    existingFileMount?: FileMountEditModel;
    workloadId: string;
    workloadType: WorkloadType;
}) {
    const { closeDialog } = useDialogContext();
    const form = useForm<FileMountEditModel>({
        resolver: zodResolver(fileMountEditZodModel),
        defaultValues: {
            ...existingFileMount,
            containerMountPath: existingFileMount?.containerMountPath ?? '',
            content: existingFileMount?.content ?? '',
        },
    });

    const [state, formAction] = useActionState((state: ServerActionResult<any, any>, payload: FileMountEditModel) =>
        saveFileMount(state, {
            ...payload,
            workloadId,
            id: existingFileMount?.id,
        }, workloadType),
        FormUtils.getInitialFormState<typeof fileMountEditZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('File Mount saved successfully', {
                description: "Click \"Deploy\" to apply the changes.",
            });
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof fileMountEditZodModel>(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <form action={() => form.handleSubmit((data) => formAction(data))()}>
                <DialogHeader>
                    <DialogTitle>{existingFileMount ? 'Edit File Mount' : 'Create File Mount'}</DialogTitle>
                    <DialogDescription>
                        Configure a file mounted into the container at the specified mount path.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <FormField
                        control={form.control}
                        name="containerMountPath"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mount Path Container</FormLabel>
                                <FormControl>
                                    <Input placeholder="ex. /data/my-config.txt" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>File Content</FormLabel>
                                <FormControl>
                                    <Textarea rows={10} placeholder="Write your file content here..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <p className="text-red-500">{state.message}</p>
                </div>
                <DialogFooter>
                    <SubmitButton>Save</SubmitButton>
                </DialogFooter>
            </form>
        </Form>
    );
}
