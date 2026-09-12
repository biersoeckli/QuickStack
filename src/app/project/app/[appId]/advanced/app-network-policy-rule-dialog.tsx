'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubmitButton } from '@/components/custom/submit-button';
import { useDialogContext } from '@/frontend/states/dialog-context';
import { AppNetworkPolicyRuleEditModel, appNetworkPolicyRuleEditZodModel, NetworkPolicyDirection, NetworkPolicySelectableTarget, NetworkPolicyTargetProject } from '@/shared/model/app-network-policy-edit.model';
import { Constants } from '@/shared/utils/constants';

const appNetworkPolicyRuleFormZodModel = appNetworkPolicyRuleEditZodModel.extend({
    projectId: z.string().optional(),
});

type AppNetworkPolicyRuleDialogProps = {
    direction: NetworkPolicyDirection;
    targets: NetworkPolicySelectableTarget[];
    currentProject: NetworkPolicyTargetProject;
    initialTarget?: NetworkPolicySelectableTarget;
    isDuplicate: (rule: AppNetworkPolicyRuleEditModel) => boolean;
    onAdd: (rule: AppNetworkPolicyRuleEditModel) => void;
};

export default function AppNetworkPolicyRuleDialog({ direction, targets, currentProject, initialTarget, isDuplicate, onAdd }: AppNetworkPolicyRuleDialogProps) {
    const { closeDialog } = useDialogContext();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const ingress = direction === 'INGRESS';
    const form = useForm<z.input<typeof appNetworkPolicyRuleFormZodModel>, unknown, z.output<typeof appNetworkPolicyRuleFormZodModel>>({
        resolver: zodResolver(appNetworkPolicyRuleFormZodModel),
        defaultValues: {
            type: direction,
            projectId: initialTarget?.project.id ?? currentProject.id,
            targetType: initialTarget?.type ?? 'APP',
            targetId: initialTarget?.id ?? '',
            port: getSuggestedPort(initialTarget) ?? '',
            protocol: 'TCP',
        },
    });

    const submit = (data: z.output<typeof appNetworkPolicyRuleFormZodModel>) => {
        const { projectId: _projectId, ...rule } = data;
        if (isDuplicate(rule)) {
            setErrorMessage('A matching network policy rule already exists.');
            return;
        }
        onAdd(rule);
        closeDialog();
    };

    const projects = Array.from(new Map([
        [currentProject.id, currentProject],
        ...targets.map(target => [target.project.id, target.project] as const),
    ]).values());
    const selectedProjectId = form.watch('projectId') ?? '';
    const targetsForSelectedProject = targets.filter(target => target.project.id === selectedProjectId);
    const selectedTargetId = form.watch('targetId');
    const selectedTargetType = form.watch('targetType');
    const selectedTarget = targetsForSelectedProject.find(target => target.id === selectedTargetId && target.type === selectedTargetType);
    const suggestedPort = getSuggestedPort(selectedTarget);

    return <>
        <DialogHeader>
            <DialogTitle>Add {ingress ? 'ingress' : 'egress'} rule</DialogTitle>
            <DialogDescription>{ingress ? 'Allow a source app or agent sandbox to access this app.' : 'Allow this app to access a target app or agent sandbox.'}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-5 py-6">
                <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select value={field.value} onValueChange={(projectId) => {
                            field.onChange(projectId);
                            form.setValue('targetId', '');
                            form.setValue('targetType', 'APP');
                            form.setValue('port', '');
                            setErrorMessage(null);
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
                            const target = targetsForSelectedProject.find(item => item.type === targetType && item.id === targetId);
                            form.setValue('targetType', targetType);
                            field.onChange(targetId);
                            form.setValue('port', getSuggestedPort(target) ?? '');
                            setErrorMessage(null);
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
                        <div className="flex items-center gap-2">
                            <FormLabel>Port</FormLabel>
                            {suggestedPort !== undefined && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Recommended: {suggestedPort}</span>}
                        </div>
                        <FormControl><Input type="number" min="1" max="65535" placeholder="e.g. 443" {...field} value={field.value ?? ''} onChange={(event) => {
                            field.onChange(event);
                            setErrorMessage(null);
                        }} /></FormControl>
                        <FormMessage />
                    </FormItem>}
                />
                <FormField
                    control={form.control}
                    name="protocol"
                    render={({ field }) => <FormItem>
                        <FormLabel>Protocol</FormLabel>
                        <Select value={field.value} onValueChange={(protocol) => {
                            field.onChange(protocol);
                            setErrorMessage(null);
                        }}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="TCP">TCP</SelectItem><SelectItem value="UDP">UDP</SelectItem></SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>}
                />
                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                <div className="flex justify-end gap-2">
                    <SubmitButton>Add rule</SubmitButton>
                    <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                </div>
            </form>
        </Form>
    </>;
}

function getSuggestedPort(target?: NetworkPolicySelectableTarget): number | undefined {
    if (!target?.appType || !(target.appType in Constants.DATABASE_TEMPLATE_PORTS)) return undefined;
    return Constants.DATABASE_TEMPLATE_PORTS[target.appType as keyof typeof Constants.DATABASE_TEMPLATE_PORTS];
}
