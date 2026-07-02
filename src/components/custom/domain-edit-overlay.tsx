'use client'

import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import CheckboxFormField from "@/components/custom/checkbox-form-field";
import { SubmitButton } from "@/components/custom/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { HostnameDnsProviderUtils } from "@/shared/utils/domain-dns-provider.utils";
import { getQuickstackDomainSuffix, saveDomain } from "@/app/project/actions";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import { DomainEditModel, domainEditZodModel } from "@/shared/model/domain-edit.model";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";

export default function DomainEditOverlay({
    existingDomain,
    workloadId,
    workloadType
}: {
    existingDomain?: DomainEditModel;
    workloadId: string;
    workloadType: WorkloadType;
}) {
    const { closeDialog } = useDialogContext();
    const [activeTab, setActiveTab] = useState<'custom' | 'quickstack'>('custom');
    const [domainSuffix, setDomainSuffix] = useState<string>();

    useEffect(() => {
        Actions.run(() => getQuickstackDomainSuffix()).then(setDomainSuffix);
    }, []);

    useEffect(() => {
        if (existingDomain?.hostname && domainSuffix) {
            setActiveTab(HostnameDnsProviderUtils.containsDnsProviderHostname(existingDomain.hostname) ? 'quickstack' : 'custom');
        }
    }, [existingDomain, domainSuffix]);

    const form = useForm<DomainEditModel>({
        resolver: zodResolver(domainEditZodModel),
        defaultValues: {
            ...existingDomain,
            hostname: existingDomain?.hostname || '',
            useSsl: existingDomain?.useSsl === false ? false : true,
            redirectHttps: existingDomain?.redirectHttps === false ? false : true,
        },
    });

    const [state, formAction] = useActionState((state: ServerActionResult<DomainEditModel, void>, payload: DomainEditModel) =>
        saveDomain(state, payload, workloadId, workloadType),
        FormUtils.getInitialFormState<typeof domainEditZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Domain saved successfully', { description: 'Klick "Deploy" to apply the changes.' });
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof domainEditZodModel>(state, form);
    }, [state]);

    useEffect(() => {
        if (existingDomain) {
            form.reset({
                ...existingDomain,
                useSsl: existingDomain.useSsl === false ? false : true,
                redirectHttps: existingDomain.redirectHttps === false ? false : true,
            });
        }
    }, [existingDomain, form]);

    const values = form.watch() as DomainEditModel;
    const getQuickstackPrefix = (hostname: string): string => {
        if (!hostname || !domainSuffix) return '';
        if (hostname.endsWith(`.${domainSuffix}`)) {
            return hostname.replace(`.${domainSuffix}`, '');
        }
        return '';
    };

    const domainFields = (quickstack = false) => (
        <div className="space-y-4">
            <FormField
                control={form.control}
                name={'hostname'}
                render={({ field }) => {
                    if (quickstack) {
                        const prefixValue = getQuickstackPrefix(field.value || '');
                        return (
                            <FormItem>
                                <FormLabel>Domain Prefix</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            placeholder="my-app"
                                            value={prefixValue}
                                            onChange={(e) => field.onChange(e.target.value ? `${e.target.value}.${domainSuffix}` : '')}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                        />

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-sm text-muted-foreground whitespace-nowrap">.{domainSuffix}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>This ist the quickstack.me <br />domain for your instance.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        );
                    }
                    return (
                        <FormItem>
                            <FormLabel>Hostname</FormLabel>
                            <FormControl>
                                <Input placeholder="example.com" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />
            <FormField
                control={form.control}
                name={'port'}
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
            <CheckboxFormField form={form} name={'useSsl' as any} label="use HTTPS" />
            {values.useSsl && <CheckboxFormField form={form as any} name={'redirectHttps' as any} label="Redirect HTTP to HTTPS" />}
        </div>
    );

    return (
        <>
            <DialogHeader>
                <DialogTitle>{existingDomain ? 'Edit Domain' : 'Create Domain'}</DialogTitle>
                <DialogDescription>Configure a custom domain for external access.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'custom' | 'quickstack')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="custom">Custom Domain</TabsTrigger>
                            {!!domainSuffix && <TabsTrigger value="quickstack">quickstack.me Domain</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="custom" className="mt-4">{domainFields()}</TabsContent>
                        <TabsContent value="quickstack" className="mt-4">{domainFields(true)}</TabsContent>
                    </Tabs>
                    <div className="mt-4 space-y-4">
                        <p className="text-red-500">{state.message}</p>
                        <SubmitButton>Save</SubmitButton>
                    </div>
                </form>
            </Form>
        </>
    );
}
