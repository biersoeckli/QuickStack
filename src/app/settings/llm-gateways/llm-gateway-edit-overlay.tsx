'use client'

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { LlmGatewayEditModel, llmGatewayEditZodModel } from "@/shared/model/llm-gateway-edit.model";
import { LlmGatewayConnectionTestResult, LlmGatewayModel } from "@/shared/model/llm-gateway.model";
import { saveLlmGateway, testLlmGatewayConnection } from "./actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";

export default function LlmGatewayEditOverlay({
    children,
    gateway,
}: {
    children: React.ReactNode;
    gateway?: LlmGatewayModel;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [loadedAliases, setLoadedAliases] = useState<string[]>([]);

    const form = useForm<LlmGatewayEditModel>({
        resolver: zodResolver(llmGatewayEditZodModel),
        defaultValues: {
            id: gateway?.id,
            name: gateway?.name ?? '',
            baseUrl: gateway?.baseUrl ?? '',
            adminKey: '',
        },
    });

    const [state, formAction] = useFormState((actionState: ServerActionResult<any, any>, payload: LlmGatewayEditModel) =>
        saveLlmGateway(actionState, {
            ...payload,
            id: gateway?.id,
        }), FormUtils.getInitialFormState<typeof llmGatewayEditZodModel>());

    useEffect(() => {
        if (state.status === 'success') {
            form.reset({
                id: gateway?.id,
                name: '',
                baseUrl: '',
                adminKey: '',
            });
            setLoadedAliases([]);
            toast.success(state.message ?? 'LLM Gateway saved successfully.');
            setIsOpen(false);
        }
        FormUtils.mapValidationErrorsToForm<typeof llmGatewayEditZodModel>(state, form);
    }, [state]);

    useEffect(() => {
        form.reset({
            id: gateway?.id,
            name: gateway?.name ?? '',
            baseUrl: gateway?.baseUrl ?? '',
            adminKey: '',
        });
        setLoadedAliases([]);
    }, [gateway]);

    const runConnectionTest = async () => {
        const values = form.getValues();
        const valid = await form.trigger();
        if (!valid) {
            return;
        }

        const result = await Toast.fromAction<LlmGatewayConnectionTestResult, LlmGatewayEditModel>(
            () => testLlmGatewayConnection({
                ...values,
                id: gateway?.id,
            }),
            'Connection successful.',
            'Testing connection...',
        );

        setLoadedAliases(result.data?.aliases ?? []);
    };

    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>{gateway ? 'Edit LLM Gateway' : 'Add LLM Gateway'}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh]">
                        <div className="px-2">
                            <Form {...form}>
                                <form action={() => form.handleSubmit((data) => formAction(data))()}>
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Name</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="baseUrl"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>LiteLLM Base URL</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="https://litellm.example.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="adminKey"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>LiteLLM Admin Key</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="password"
                                                            placeholder={gateway?.hasAdminKey ? 'Leave blank to keep existing key' : ''}
                                                            {...field}
                                                            value={field.value ?? ''}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" onClick={runConnectionTest}>
                                                Test Connection
                                            </Button>
                                            <SubmitButton>Save</SubmitButton>
                                        </div>

                                        {loadedAliases.length > 0 ? (
                                            <div className="space-y-2 rounded-md border p-3">
                                                <p className="text-sm font-medium">Live LiteLLM Model Aliases</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {loadedAliases.map((alias) => (
                                                        <div key={alias} className="rounded-md border px-2 py-1 text-xs">
                                                            {alias}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        {gateway?.hasAdminKey ? (
                                            <p className="text-sm text-muted-foreground">
                                                Stored admin key stays hidden. Enter new value only to rotate it.
                                            </p>
                                        ) : null}

                                        <p className="text-red-500">{state.message}</p>
                                    </div>
                                </form>
                            </Form>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
}
