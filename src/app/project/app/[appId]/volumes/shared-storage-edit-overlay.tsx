'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useFormState } from 'react-dom'
import { useEffect, useState } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AppVolumeEditModel, appVolumeEditZodModel } from "@/shared/model/volume-edit.model"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { saveVolume, getShareableVolumes } from "./actions"
import { toast } from "sonner"
import { AppExtendedModel } from "@/shared/model/app-extended.model"
import SelectFormField from "@/components/custom/select-form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

type ShareableVolume = {
    id: string;
    containerMountPath: string;
    size: number;
    storageClassName: string;
    accessMode: string;
    app: { name: string };
};

export default function SharedStorageEditDialog({ children, app }: {
    children: React.ReactNode;
    app: AppExtendedModel;
}) {

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [shareableVolumes, setShareableVolumes] = useState<ShareableVolume[]>([]);
    const [isLoadingVolumes, setIsLoadingVolumes] = useState(false);

    const form = useForm<AppVolumeEditModel>({
        resolver: zodResolver(appVolumeEditZodModel),
        defaultValues: {
            containerMountPath: '',
            size: 0,
            accessMode: 'ReadWriteMany',
            storageClassName: 'longhorn',
            sharedVolumeId: undefined,
        }
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppVolumeEditModel) =>
        saveVolume(state, {
            ...payload,
            appId: app.id,
            id: undefined
        }), FormUtils.getInitialFormState<typeof appVolumeEditZodModel>());

    // Fetch shareable volumes when dialog opens
    useEffect(() => {
        if (isOpen) {
            setIsLoadingVolumes(true);
            getShareableVolumes(app.id).then(result => {
                if (result.status === 'success' && result.data) {
                    setShareableVolumes(result.data);
                } else {
                    setShareableVolumes([]);
                }
                setIsLoadingVolumes(false);
            });
        }
    }, [isOpen, app.id]);

    // Watch selected volume and auto-fill fields
    const watchedSharedVolumeId = form.watch("sharedVolumeId");
    useEffect(() => {
        if (watchedSharedVolumeId) {
            const selectedVolume = shareableVolumes.find(v => v.id === watchedSharedVolumeId);
            if (selectedVolume) {
                form.setValue("size", selectedVolume.size);
                form.setValue("accessMode", selectedVolume.accessMode);
                form.setValue("storageClassName", selectedVolume.storageClassName as 'longhorn' | 'local-path');
            }
        }
    }, [watchedSharedVolumeId, shareableVolumes]);

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Shared volume mounted successfully', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
            setIsOpen(false);
        }
        FormUtils.mapValidationErrorsToForm<typeof appVolumeEditZodModel>(state, form);
    }, [state]);

    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>
            <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Mount Shared Volume</DialogTitle>
                        <DialogDescription>
                            Mount an existing ReadWriteMany volume from another app in this project.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form action={(e) => form.handleSubmit((data) => {
                            return formAction(data);
                        })()}>
                            <div className="space-y-4">
                                {isLoadingVolumes ? (
                                    <div className="text-sm text-muted-foreground">Loading shareable volumes...</div>
                                ) : shareableVolumes.length === 0 ? (
                                    <Alert>
                                        <Info className="h-4 w-4" />
                                        <AlertDescription>
                                            No shareable volumes available. Create a ReadWriteMany volume in another app and enable sharing first.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <>
                                        <SelectFormField
                                            form={form}
                                            name="sharedVolumeId"
                                            label="Select Shared Volume"
                                            values={shareableVolumes.map(v => [
                                                v.id,
                                                `${v.app.name} - ${v.containerMountPath} (${v.size}MB)`
                                            ])}
                                            placeholder="Select volume to share..."
                                        />

                                        <FormField
                                            control={form.control}
                                            name="containerMountPath"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Mount Path in This Container</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="ex. /shared-data" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p><strong>Size:</strong> {form.watch("size")} MB (inherited from shared volume)</p>
                                            <p><strong>Storage Class:</strong> {form.watch("storageClassName")} (inherited from shared volume)</p>
                                        </div>
                                    </>
                                )}

                                <p className="text-red-500">{state.message}</p>
                                {shareableVolumes.length > 0 && <SubmitButton>Mount Shared Volume</SubmitButton>}
                            </div>
                        </form>
                    </Form >
                </DialogContent>
            </Dialog>
        </>
    )
}
