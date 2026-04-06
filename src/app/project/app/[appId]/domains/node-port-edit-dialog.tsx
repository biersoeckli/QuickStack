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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useFormState } from 'react-dom'
import { useEffect, useState } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AppNodePort } from "@prisma/client"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { saveNodePort } from "./actions"
import { toast } from "sonner"
import { NodePortEditModel, nodePortEditZodModel } from "@/shared/model/node-port-edit.model"

export default function NodePortEditDialog({ children, appNodePort, appId }: { children: React.ReactNode; appNodePort?: AppNodePort; appId: string; }) {

    const [isOpen, setIsOpen] = useState<boolean>(false);

    const form = useForm<NodePortEditModel>({
        resolver: zodResolver(nodePortEditZodModel),
        defaultValues: appNodePort ? {
            port: appNodePort.port,
            nodePort: appNodePort.nodePort,
            protocol: appNodePort.protocol as 'TCP' | 'UDP',
        } : { protocol: 'TCP' }
    });

    const [state, formAction] = useFormState(
        (state: ServerActionResult<any, any>, payload: NodePortEditModel) =>
            saveNodePort(state, { ...payload, appId, id: appNodePort?.id }),
        FormUtils.getInitialFormState<typeof nodePortEditZodModel>()
    );

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Node port saved successfully.', {
                description: 'Click "deploy" to apply the changes to your app.',
            });
            setIsOpen(false);
        }
        FormUtils.mapValidationErrorsToForm<typeof nodePortEditZodModel>(state, form);
    }, [state]);

    useEffect(() => {
        if (appNodePort) {
            form.reset({
                port: appNodePort.port,
                nodePort: appNodePort.nodePort,
                protocol: appNodePort.protocol as 'TCP' | 'UDP',
            });
        }
    }, [appNodePort]);

    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>
            <Dialog open={!!isOpen} onOpenChange={() => setIsOpen(false)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{appNodePort ? 'Edit' : 'Add'} Node Port</DialogTitle>
                        <DialogDescription>
                            Expose this app directly on a host/node port. Changes take effect after redeployment.
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
                                            <FormLabel>Container Port</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="8080" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="nodePort"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Node Port</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="30080" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="protocol"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Protocol</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select protocol" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="TCP">TCP</SelectItem>
                                                    <SelectItem value="UDP">UDP</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <p className="text-red-500">{state.message}</p>
                                <SubmitButton>Save</SubmitButton>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    );
}
