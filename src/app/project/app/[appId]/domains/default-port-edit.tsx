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
import { AppPort } from "@prisma/client"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { savePort } from "./actions"
import { toast } from "sonner"
import { AppPortModel, appPortZodModel } from "@/shared/model/default-port.model"



export default function DefaultPortEditDialog({ children, appPort, appId }: { children: React.ReactNode; appPort?: AppPort; appId: string; }) {

    const [isOpen, setIsOpen] = useState<boolean>(false);

    const form = useForm<AppPortModel>({
        resolver: zodResolver(appPortZodModel),
        defaultValues: appPort
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppPortModel) =>
        savePort(state, payload, appId, appPort?.id), FormUtils.getInitialFormState<typeof appPortZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Port saved successfully. ', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
            setIsOpen(false);
        }
        FormUtils.mapValidationErrorsToForm<typeof appPortZodModel>(state, form);
    }, [state]);

    const values = form.watch();

    useEffect(() => {
        form.reset(appPort);
    }, [appPort]);


    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>
            <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Internal Port</DialogTitle>
                        <DialogDescription>
                            Edit the internal port for the application.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form action={(e) => form.handleSubmit((data) => {
                            return formAction(data);
                        })()}>
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="port"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Port</FormLabel>
                                            <FormControl>
                                                <Input placeholder="80" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <p className="text-red-500">{state.message}</p>
                                <SubmitButton>Save</SubmitButton>
                            </div>
                        </form>
                    </Form >
                </DialogContent>
            </Dialog>
        </>
    )



}