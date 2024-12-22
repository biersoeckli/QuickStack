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
import { AppDomain } from "@prisma/client"
import { AppDomainEditModel, appDomainEditZodModel } from "@/shared/model/domain-edit.model"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { saveDomain } from "./actions"
import { toast } from "sonner"
import CheckboxFormField from "@/components/custom/checkbox-form-field"



export default function DialogEditDialog({ children, domain, appId }: { children: React.ReactNode; domain?: AppDomain; appId: string; }) {

    const [isOpen, setIsOpen] = useState<boolean>(false);

    const form = useForm<AppDomainEditModel>({
        resolver: zodResolver(appDomainEditZodModel),
        defaultValues: {
            ...domain,
            useSsl: domain?.useSsl === false ? false : true
        }
    });

    const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppDomainEditModel) =>
        saveDomain(state, {
            ...payload,
            appId,
            id: domain?.id
        }), FormUtils.getInitialFormState<typeof appDomainEditZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Domain saved successfully. ', {
                description: "Click \"deploy\" to apply the changes to your app.",
            });
            setIsOpen(false);
        }
        FormUtils.mapValidationErrorsToForm<typeof appDomainEditZodModel>(state, form);
    }, [state]);

    const values = form.watch();

    useEffect(() => {
        form.reset(domain);
    }, [domain]);

    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>
            <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Domain</DialogTitle>
                        <DialogDescription>
                            Configure your custom domain for this application. Note that the domain must be pointing to the server IP address.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form action={(e) => form.handleSubmit((data) => {
                            return formAction(data);
                        })()}>
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="hostname"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hostname</FormLabel>
                                            <FormControl>
                                                <Input placeholder="example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="port"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>App Port</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="ex. 80" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <CheckboxFormField form={form} name="useSsl" label="use HTTPS" />
                                {values.useSsl && <CheckboxFormField form={form} name="redirectHttps" label="Redirect HTTP to HTTPS" />}
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