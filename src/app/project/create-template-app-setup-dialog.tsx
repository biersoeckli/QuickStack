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
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { toast } from "sonner"
import { AppTemplateModel, appTemplateZodModel } from "@/shared/model/app-template.model"
import { createAppFromTemplate } from "./actions"

export default function CreateTemplateAppSetupDialog({
    appTemplate,
    projectId,
    dialogClosed
}: {
    appTemplate?: AppTemplateModel;
    projectId: string;
    dialogClosed?: () => void;
}) {

    const [isOpen, setIsOpen] = useState<boolean>(false);

    const form = useForm<AppTemplateModel>({
        resolver: zodResolver(appTemplateZodModel),
        defaultValues: appTemplate
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>,
        payload: AppTemplateModel) => createAppFromTemplate(state, payload, projectId!),
        FormUtils.getInitialFormState<typeof appTemplateZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('App created successfully');
            setIsOpen(false);
        }
        FormUtils.mapValidationErrorsToForm<typeof appTemplateZodModel>(state, form);
    }, [state]);

    const values = form.watch();

    useEffect(() => {
        setIsOpen(!!appTemplate && !!projectId);
        form.reset(appTemplate);
    }, [appTemplate, projectId]);

    return (
        <>
            <Dialog open={!!isOpen} onOpenChange={(isOpened) => {
                setIsOpen(isOpened);
                if (!isOpened && dialogClosed) {
                    dialogClosed();
                }
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create App "{appTemplate?.name}"</DialogTitle>
                        <DialogDescription>
                            Insert your values for the template.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form action={(e) => form.handleSubmit((data) => {
                            return formAction(data);
                        })()}>
                            {appTemplate?.templates.map((t, templateIndex) =>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name={`templates[${templateIndex}].appModel.name` as any}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>App Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {t.inputSettings.map((input, settingsIndex) => (
                                        <FormField
                                            control={form.control}
                                            name={`templates[${templateIndex}].inputSettings[${settingsIndex}].value` as any}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{input.label}</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ))}

                                    <p className="text-red-500">{state.message}</p>
                                    <SubmitButton>Save</SubmitButton>
                                </div>
                            )}
                        </form>
                    </Form >
                </DialogContent>
            </Dialog>
        </>
    )



}