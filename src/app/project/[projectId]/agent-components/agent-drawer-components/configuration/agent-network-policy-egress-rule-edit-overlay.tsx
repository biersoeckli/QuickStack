'use client'

import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import SelectFormField from "@/components/custom/select-form-field";
import { SubmitButton } from "@/components/custom/submit-button";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { useDialogContext } from "@/frontend/states/dialog-context";
import {
    AgentNetworkPolicyEgressRuleEditModel,
    agentNetworkPolicyEgressRuleEditZodModel,
} from "@/shared/model/agent-network-policy-edit.model";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { getAppsForAgentNetworkPolicy, saveAgentNetworkPolicyEgressRule } from "./actions";
import { z } from "zod";

type AgentNetworkPolicyRule = NonNullable<AgentExtendedModel['agentNetworkPolicy']>['rules'][number];

type ProjectWithApps = {
    id: string;
    name: string;
    apps: { id: string; name: string }[];
};

const agentNetworkPolicyEgressRuleFormZodModel = agentNetworkPolicyEgressRuleEditZodModel.extend({
    projectId: z.string().optional(),
});

export default function AgentNetworkPolicyEgressRuleEditOverlay({
    existingRule,
    agentId,
}: {
    existingRule?: AgentNetworkPolicyRule;
    agentId: string;
}) {
    const { closeDialog } = useDialogContext();
    const [projects, setProjects] = useState<ProjectWithApps[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getAppsForAgentNetworkPolicy(agentId).then(result => {
            if (result.status === 'success' && result.data) {
                setProjects(result.data);
            } else {
                toast.error('An error occurred while fetching apps for this project.');
            }
            setIsLoading(false);
        });
    }, [agentId]);

    const existingProjectId = existingRule?.targetApp.projectId;

    const form = useForm<z.input<typeof agentNetworkPolicyEgressRuleFormZodModel>, unknown, z.output<typeof agentNetworkPolicyEgressRuleFormZodModel>>({
        resolver: zodResolver(agentNetworkPolicyEgressRuleFormZodModel),
        defaultValues: {
            projectId: existingProjectId ?? '',
            targetAppId: existingRule?.targetAppId ?? '',
            port: existingRule?.port ?? undefined,
            protocol: (existingRule?.protocol as 'TCP' | 'UDP') ?? 'TCP',
        },
    });

    const [state, formAction] = useActionState(
        (state: ServerActionResult<AgentNetworkPolicyEgressRuleEditModel, void>, payload: AgentNetworkPolicyEgressRuleEditModel) =>
            saveAgentNetworkPolicyEgressRule(state, { ...payload, id: existingRule?.id }, agentId),
        FormUtils.getInitialFormState<typeof agentNetworkPolicyEgressRuleEditZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            toast.success('Egress rule saved successfully', { description: 'Click "Deploy" to apply the changes.' });
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof agentNetworkPolicyEgressRuleFormZodModel>(state, form);
    }, [closeDialog, form, state]);

    const selectedProjectId = form.watch('projectId') ?? '';
    const appsForSelectedProject = projects.find(p => p.id === selectedProjectId)?.apps ?? [];

    return (
        <>
            <DialogHeader>
                <DialogTitle>{existingRule ? 'Edit Egress Rule' : 'Add Egress Rule'}</DialogTitle>
                <DialogDescription>
                    Allow this agent to connect to a specific app on a given port and protocol.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form action={() => form.handleSubmit((data) => formAction(data))()} className="space-y-4">
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading apps...</p>
                    ) : (
                        <>
                            <SelectFormField
                                form={form as any}
                                name="projectId"
                                label="Project"
                                placeholder="Select project..."
                                values={projects.map(p => [p.id, p.name])}
                                onValueChange={() => form.setValue('targetAppId', '')}
                            />
                            <SelectFormField
                                form={form as any}
                                name="targetAppId"
                                label="App"
                                placeholder="Select app..."
                                values={appsForSelectedProject.map(app => [app.id, app.name])}
                            />
                        </>
                    )}
                    <FormField
                        control={form.control}
                        name="port"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Port</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="ex. 5432" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <SelectFormField
                        form={form as any}
                        name="protocol"
                        label="Protocol"
                        values={[['TCP', 'TCP'], ['UDP', 'UDP']]}
                    />
                    <p className="text-red-500">{state.message}</p>
                    <SubmitButton>Save</SubmitButton>
                </form>
            </Form>
        </>
    );
}
