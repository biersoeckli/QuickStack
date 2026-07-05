'use client'

import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Fragment, useActionState, useEffect } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { toast } from "sonner"
import { AppTemplateModel, appTemplateZodModel } from "@/shared/model/app-template.model"
import { createAppFromTemplate } from "./actions"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDialogContext } from "@/frontend/states/dialog-context"

export default function CreateTemplateAppSetupDialog({
    appTemplate,
    projectId
}: {
    appTemplate: AppTemplateModel;
    projectId: string;
}) {
    const { closeDialog } = useDialogContext();

    const form = useForm<AppTemplateModel>({
        resolver: zodResolver(appTemplateZodModel),
        defaultValues: appTemplate
    });

    const [state, formAction] = useActionState((state: ServerActionResult<any, any>,
        payload: AppTemplateModel) => createAppFromTemplate(state, payload, projectId!),
        FormUtils.getInitialFormState<typeof appTemplateZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            const appLabel = ((appTemplate?.templates.length ?? 0) > 1) ? 'Apps' : 'App';
            toast.success(`${appLabel} Created successfully`, {
                description: `Click deploy to start the ${appLabel}.`,
            });
            closeDialog(true);
        }
        FormUtils.mapValidationErrorsToForm<typeof appTemplateZodModel>(state, form);
    }, [appTemplate?.templates.length, closeDialog, form, state]);

    useEffect(() => {
        form.reset(appTemplate);
    }, [appTemplate, form, projectId]);

    return (
        <>
            <DialogHeader>
                <DialogTitle>Create App &quot;{appTemplate.name}&quot;</DialogTitle>
                <DialogDescription>
                    Insert your values for the template.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
                <div className="px-2">
                    <Form {...form} >
                        <form action={() => form.handleSubmit((data) => {
                            return formAction(data);
                        })()}>
                            <div className="space-y-6">
                                {appTemplate.templates.map((t, templateIndex) => (
                                    <Fragment key={templateIndex}>
                                        {templateIndex > 0 && <div className="border-t pb-4"></div>}
                                        {appTemplate.templates.length > 1 &&
                                            <div className="text-2xl font-semibold">{t.appModel.name}</div>}
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
                                                key={settingsIndex}
                                                control={form.control}
                                                name={`templates[${templateIndex}].inputSettings[${settingsIndex}].value` as any}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{input.label}</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        {input.randomGeneratedIfEmpty &&
                                                            <FormDescription>If left empty, a random value will be generated.</FormDescription>}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </Fragment>
                                ))}
                                <p className="text-red-500">{state.message}</p>
                                <SubmitButton>Create</SubmitButton>
                            </div>

                        </form>
                    </Form >
                </div>
            </ScrollArea>
        </>
    )



}
