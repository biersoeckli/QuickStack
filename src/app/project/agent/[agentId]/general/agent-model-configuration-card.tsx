'use client';

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/custom/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { agentModelConfigurationZodModel, AgentModelConfigurationModel } from "@/shared/model/agent-config.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveAgentModelConfiguration } from "./actions";
import { getLlmGateways, getModelAliasesForGateway } from "../../../[projectId]/actions";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { LlmGatewayModel } from "@/shared/model/llm-gateway.model";
import { Loader2 } from "lucide-react";

export default function AgentModelConfigurationCard({ agent, readonly }: {
    agent: AgentExtendedModel;
    readonly: boolean;
}) {
    const [gateways, setGateways] = useState<LlmGatewayModel[]>([]);
    const [modelAliases, setModelAliases] = useState<string[]>([]);
    const [loadingAliases, setLoadingAliases] = useState(false);
    const [selectedGatewayId, setSelectedGatewayId] = useState(agent.llmGatewayId || '');

    useEffect(() => {
        getLlmGateways().then((r: any) => {
            if (r?.data) setGateways(r.data);
        });
    }, []);

    const form = useForm<AgentModelConfigurationModel>({
        resolver: zodResolver(agentModelConfigurationZodModel),
        defaultValues: {
            llmGatewayId: agent.llmGatewayId || '',
            modelAlias: agent.modelAlias || '',
        },
        disabled: readonly,
    });

    useEffect(() => {
        if (!selectedGatewayId) {
            setModelAliases([]);
            return;
        }
        loadModelAliases(selectedGatewayId);
    }, [selectedGatewayId]);

    const loadModelAliases = async (gatewayId: string) => {
        setLoadingAliases(true);
        try {
            const result = await getModelAliasesForGateway(gatewayId);
            if (result?.data) {
                setModelAliases(result.data as string[]);
            } else if (Array.isArray(result)) {
                setModelAliases(result as string[]);
            } else {
                setModelAliases([]);
            }
        } catch {
            setModelAliases([]);
        } finally {
            setLoadingAliases(false);
        }
    };

    const [state, formAction] = useActionState(
        (state: ServerActionResult<any, any>, payload: AgentModelConfigurationModel) =>
            saveAgentModelConfiguration(state, payload, agent.id),
        FormUtils.getInitialFormState<typeof agentModelConfigurationZodModel>(),
    );

    useEffect(() => {
        if (state.status === 'success') {
            toast.success('Model configuration saved. Click "Deploy" to apply changes.');
        }
        FormUtils.mapValidationErrorsToForm<typeof agentModelConfigurationZodModel>(state, form);
    }, [state]);

    return (
        <Form {...form}>
            <form action={(e) => form.handleSubmit((data) => formAction(data))()}>
                <Card>
                    <CardHeader>
                        <CardTitle>Model Configuration</CardTitle>
                        <CardDescription>
                            Configure the LLM gateway and model for this agent.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="llmGatewayId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>LLM Gateway</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            setSelectedGatewayId(value);
                                        }}
                                        defaultValue={field.value ?? ''}
                                        disabled={readonly}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a gateway" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {gateways.map((gw) => (
                                                <SelectItem key={gw.id} value={gw.id}>
                                                    {gw.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="modelAlias"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Model Alias</FormLabel>
                                    {!selectedGatewayId ? (
                                        <p className="text-sm text-muted-foreground">Select a gateway first</p>
                                    ) : loadingAliases ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading model aliases...
                                        </div>
                                    ) : modelAliases.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No model aliases available</p>
                                    ) : (
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value ?? ''}
                                            disabled={readonly}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a model alias" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {modelAliases.map((alias) => (
                                                    <SelectItem key={alias} value={alias}>
                                                        {alias}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    {!readonly && (
                        <CardFooter className="gap-4">
                            <SubmitButton>Save Model Configuration</SubmitButton>
                            {state?.status === 'error' && !state?.errors && (
                                <p className="text-sm text-red-500">{state.message}</p>
                            )}
                        </CardFooter>
                    )}
                </Card>
            </form>
        </Form>
    );
}
