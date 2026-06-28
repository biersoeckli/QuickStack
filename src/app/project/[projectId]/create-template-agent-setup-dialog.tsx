'use client'

import { Fragment, useActionState, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/custom/submit-button";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { AgentTemplateModel, agentTemplateZodModel } from "@/shared/model/agent-template.model";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { createAgentFromTemplate, getLlmGateways, getModelAliasesForGateway } from "./actions";

interface LlmGatewayOption {
    id: string;
    name: string;
}

export default function CreateTemplateAgentSetupDialog({
    agentTemplate,
    projectId,
    dialogClosed
}: {
    agentTemplate?: AgentTemplateModel;
    projectId: string;
    dialogClosed?: () => void;
}) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [gateways, setGateways] = useState<LlmGatewayOption[]>([]);
    const [loadingGateways, setLoadingGateways] = useState(false);
    const [loadingAliases, setLoadingAliases] = useState<Record<number, boolean>>({});
    const [modelAliases, setModelAliases] = useState<Record<number, string[]>>({});

    const form = useForm<AgentTemplateModel>({
        resolver: zodResolver(agentTemplateZodModel),
        defaultValues: agentTemplate
    });

    const [state, formAction] = useActionState((state: ServerActionResult<any, any>,
        payload: AgentTemplateModel) => createAgentFromTemplate(state, payload, projectId),
        FormUtils.getInitialFormState<typeof agentTemplateZodModel>());

    useEffect(() => {
        const loadGateways = async () => {
            setLoadingGateways(true);
            try {
                const result = await Actions.run(() => getLlmGateways());
                setGateways(result as LlmGatewayOption[]);
            } catch (error) {
                toast.error('Failed to load LLM gateways.');
                console.error('Failed to load LLM gateways:', error);
            } finally {
                setLoadingGateways(false);
            }
        };
        loadGateways();
    }, []);

    useEffect(() => {
        if (state.status === 'success') {
            form.reset();
            const agentLabel = ((agentTemplate?.templates.length ?? 0) > 1) ? 'Agents' : 'Agent';
            toast.success(`${agentLabel} created successfully`, {
                description: `Click deploy to start the ${agentLabel}.`,
            });
            setIsOpen(false);
            dialogClosed?.();
        }
        FormUtils.mapValidationErrorsToForm<typeof agentTemplateZodModel>(state, form);
    }, [state]);

    useEffect(() => {
        setIsOpen(!!agentTemplate && !!projectId);
        form.reset(agentTemplate);
        setModelAliases({});
        setLoadingAliases({});
    }, [agentTemplate, projectId]);

    const loadModelAliases = async (templateIndex: number, gatewayId: string) => {
        form.setValue(`templates.${templateIndex}.modelAlias` as any, undefined);
        setLoadingAliases((current) => ({ ...current, [templateIndex]: true }));
        try {
            const result = await Actions.run(() => getModelAliasesForGateway(gatewayId));
            setModelAliases((current) => ({ ...current, [templateIndex]: result as string[] }));
        } catch (error) {
            toast.error('Failed to load model aliases.');
            console.error('Failed to load model aliases:', error);
            setModelAliases((current) => ({ ...current, [templateIndex]: [] }));
        } finally {
            setLoadingAliases((current) => ({ ...current, [templateIndex]: false }));
        }
    };

    return (
        <Dialog open={!!isOpen} onOpenChange={(isOpened) => {
            setIsOpen(isOpened);
            if (!isOpened) {
                dialogClosed?.();
            }
        }}>
            <DialogContent className="sm:max-w-[540px]">
                <DialogHeader>
                    <DialogTitle>Create Agent &quot;{agentTemplate?.name}&quot;</DialogTitle>
                    <DialogDescription>
                        Insert your values for the template.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                    <div className="px-2">
                        <Form {...form}>
                            <form action={() => form.handleSubmit((data) => formAction(data))()}>
                                <div className="space-y-6">
                                    {agentTemplate?.templates.map((t, templateIndex) => (
                                        <Fragment key={templateIndex}>
                                            {templateIndex > 0 && <div className="border-t pb-4"></div>}
                                            {agentTemplate.templates.length > 1 &&
                                                <div className="text-xl font-semibold">{t.agentModel.name}</div>}
                                            <FormField
                                                control={form.control}
                                                name={`templates.${templateIndex}.agentModel.name` as any}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Agent Name</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`templates.${templateIndex}.llmGatewayId` as any}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>LLM Gateway</FormLabel>
                                                        {loadingGateways ? (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading gateways...
                                                            </div>
                                                        ) : (
                                                            <Select value={field.value} onValueChange={(value) => {
                                                                field.onChange(value);
                                                                loadModelAliases(templateIndex, value);
                                                            }}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select an LLM Gateway" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {gateways.map((gateway) => (
                                                                        <SelectItem key={gateway.id} value={gateway.id}>
                                                                            {gateway.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`templates.${templateIndex}.modelAlias` as any}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Model Alias</FormLabel>
                                                        {loadingAliases[templateIndex] ? (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading model aliases...
                                                            </div>
                                                        ) : (
                                                            <Select value={field.value} onValueChange={field.onChange} disabled={!form.watch(`templates.${templateIndex}.llmGatewayId` as any)}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select a model alias" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {(modelAliases[templateIndex] ?? []).map((alias) => (
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
                                            {t.inputSettings.map((input, settingsIndex) => (
                                                <FormField
                                                    key={settingsIndex}
                                                    control={form.control}
                                                    name={`templates.${templateIndex}.inputSettings.${settingsIndex}.value` as any}
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
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
