'use client';

import { useActionState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubmitButton } from '@/components/custom/submit-button';
import { useDialogContext } from '@/frontend/states/dialog-context';
import { FormUtils } from '@/frontend/utils/form.utilts';
import { ServerActionResult } from '@/shared/model/server-action-error-return.model';
import { AppNetworkPolicyRuleEditModel, appNetworkPolicyRuleEditZodModel } from '@/shared/model/app-network-policy-edit.model';
import { saveAppNetworkPolicyRule } from './actions';

type Direction = 'INGRESS' | 'EGRESS';
type Project = { id: string; name: string };
type SelectableApp = { id: string; name: string; project: Project };

export default function AppNetworkPolicyRuleDialog({ appId, direction, apps }: { appId: string; direction: Direction; apps: SelectableApp[] }) {
    const { closeDialog } = useDialogContext();
    const ingress = direction === 'INGRESS';
    const form = useForm<z.input<typeof appNetworkPolicyRuleEditZodModel>, unknown, z.output<typeof appNetworkPolicyRuleEditZodModel>>({
        resolver: zodResolver(appNetworkPolicyRuleEditZodModel),
        defaultValues: { type: direction, targetAppId: '', port: '', protocol: 'TCP' },
    });
    const [state, formAction] = useActionState(
        (state: ServerActionResult<any, any>, payload: AppNetworkPolicyRuleEditModel) =>
            saveAppNetworkPolicyRule(state, payload, appId),
        FormUtils.getInitialFormState<typeof appNetworkPolicyRuleEditZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Rule saved.');
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof appNetworkPolicyRuleEditZodModel>(state, form);
    }, [closeDialog, form, state]);

    return <>
        <DialogHeader>
            <DialogTitle>Add {ingress ? 'ingress' : 'egress'} rule</DialogTitle>
            <DialogDescription>{ingress ? 'Allow a source app to access this app.' : 'Allow this app to access a target app.'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form action={() => form.handleSubmit(data => formAction(data))()} className="space-y-5 py-6">
                <FormField
                    control={form.control}
                    name="targetAppId"
                    render={({ field }) => <FormItem>
                        <FormLabel>{ingress ? 'Source App' : 'Target App'}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select app" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {apps.map(app => <SelectItem key={app.id} value={app.id}>{app.project.name} / {app.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>}
                />
                <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl><Input type="number" min="1" max="65535" placeholder="e.g. 443" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>}
                />
                <FormField
                    control={form.control}
                    name="protocol"
                    render={({ field }) => <FormItem>
                        <FormLabel>Protocol</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="TCP">TCP</SelectItem><SelectItem value="UDP">UDP</SelectItem></SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>}
                />
                {state.message && <p className="text-sm text-destructive">{state.message}</p>}
                <div className="flex justify-end gap-2">
                    <SubmitButton>Add rule</SubmitButton>
                    <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                </div>
            </form>
        </Form>
    </>;
}
