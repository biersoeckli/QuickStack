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
type SelectableTarget = { id: string; name: string; type: 'APP' | 'AGENT'; project: Project };
const appNetworkPolicyRuleFormZodModel = appNetworkPolicyRuleEditZodModel.extend({
    projectId: z.string().optional(),
});

export default function AppNetworkPolicyRuleDialog({ appId, direction, targets, currentProject }: { appId: string; direction: Direction; targets: SelectableTarget[]; currentProject: Project }) {
    const { closeDialog } = useDialogContext();
    const ingress = direction === 'INGRESS';
    const form = useForm<z.input<typeof appNetworkPolicyRuleFormZodModel>, unknown, z.output<typeof appNetworkPolicyRuleFormZodModel>>({
        resolver: zodResolver(appNetworkPolicyRuleFormZodModel),
        defaultValues: { type: direction, projectId: currentProject.id, targetType: 'APP', targetId: '', port: '', protocol: 'TCP' },
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
        FormUtils.mapValidationErrorsToForm<typeof appNetworkPolicyRuleFormZodModel>(state, form);
    }, [closeDialog, form, state]);

    const projects = Array.from(new Map([
        [currentProject.id, currentProject],
        ...targets.map(target => [target.project.id, target.project] as const),
    ]).values());
    const selectedProjectId = form.watch('projectId') ?? '';
    const targetsForSelectedProject = targets.filter(target => target.project.id === selectedProjectId);

    return <>
        <DialogHeader>
            <DialogTitle>Add {ingress ? 'ingress' : 'egress'} rule</DialogTitle>
            <DialogDescription>{ingress ? 'Allow a source app or agent sandbox to access this app.' : 'Allow this app to access a target app or agent sandbox.'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form action={() => form.handleSubmit(data => formAction(data))()} className="space-y-5 py-6">
                <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select value={field.value} onValueChange={(projectId) => {
                            field.onChange(projectId);
                            form.setValue('targetId', '');
                            form.setValue('targetType', 'APP');
                        }}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {projects.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>}
                />
                <FormField
                    control={form.control}
                    name="targetId"
                    render={({ field }) => <FormItem>
                        <FormLabel>{ingress ? 'Source' : 'Target'}</FormLabel>
                        <Select disabled={!selectedProjectId} value={field.value ? `${form.getValues('targetType')}:${field.value}` : ''} onValueChange={(value) => {
                            const [targetType, targetId] = value.split(':') as ['APP' | 'AGENT', string];
                            form.setValue('targetType', targetType);
                            field.onChange(targetId);
                        }}>
                            <FormControl><SelectTrigger><SelectValue placeholder={selectedProjectId ? 'Select app or agent sandbox' : 'Select project first'} /></SelectTrigger></FormControl>
                            <SelectContent>
                                {targetsForSelectedProject.map(target => <SelectItem key={`${target.type}:${target.id}`} value={`${target.type}:${target.id}`}>{target.name} ({target.type === 'APP' ? 'App' : 'Agent sandbox'})</SelectItem>)}
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
