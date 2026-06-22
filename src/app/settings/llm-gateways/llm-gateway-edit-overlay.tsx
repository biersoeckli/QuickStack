'use client'

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useFormState } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { LlmGatewayEditModel, llmGatewayEditZodModel } from "@/shared/model/llm-gateway-edit.model";
import { LlmGatewayModel } from "@/shared/model/llm-gateway.model";
import { saveLlmGateway, testLlmGatewayConnection } from "./actions";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/custom/submit-button";
import { Button } from "@/components/ui/button";
import { Toast } from "@/frontend/utils/toast.utils";
import { useDialog } from "@/frontend/states/zustand.states";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

function LlmGatewayForm({ gateway }: { gateway?: LlmGatewayModel }) {
    const { closeDialog } = useDialogContext();

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
            toast.success(state.message ?? 'LLM Gateway saved successfully.');
            closeDialog();
        }
        FormUtils.mapValidationErrorsToForm<typeof llmGatewayEditZodModel>(state, form);
    }, [state]);

    const runConnectionTest = async () => {
        const values = form.getValues();
        const valid = await form.trigger();
        if (!valid) {
            toast.error('Please fill out all fields before testing the connection.');
            return;
        }

        await Toast.fromAction(
            () => testLlmGatewayConnection({
                ...values,
                id: gateway?.id,
            }),
            'Connection successful.',
            'Testing connection...',
        );
    };

    return (
        <Form {...form}>
            <form
                className="flex max-h-[80vh] flex-col overflow-hidden"
                action={() => form.handleSubmit((data) => formAction(data))()}
            >
                <DialogHeader>
                    <DialogTitle>{gateway ? 'Edit LLM Gateway' : 'Add LLM Gateway'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="mt-4 flex-1 min-h-0">
                    <div className="space-y-4 px-2">
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

                    {gateway?.hasAdminKey ? (
                        <p className="text-sm text-muted-foreground">
                            Stored admin key stays hidden. Enter new value only to rotate it.
                        </p>
                    ) : null}

                    <p className="text-red-500">{state.message}</p>
                </div>
                </ScrollArea>
                <DialogFooter className="mt-4">
                    <SubmitButton>Save</SubmitButton>
                    <Button type="button" variant="outline" onClick={runConnectionTest}>
                        Test Connection
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

export default function LlmGatewayEditOverlay({
    children,
    gateway,
}: {
    children: React.ReactNode;
    gateway?: LlmGatewayModel;
}) {
    const { openDialog } = useDialog();

    const handleOpen = () => {
        openDialog(<LlmGatewayForm gateway={gateway} />, { maxWidth: '520px' });
    };

    return (
        <div onClick={handleOpen}>
            {children}
        </div>
    );
}
