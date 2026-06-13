'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { Toast } from "@/frontend/utils/toast.utils";
import { cn } from "@/frontend/utils/utils";
import { restApiKeyCreateZodModel, RestApiKeyCreateModel } from "@/shared/model/rest-api-key.model";
import { createRestApiKey } from "./actions";

export function CreateApiKeyDialog({ onCreated }: { onCreated: (rawApiKey: string) => void }) {
    const { closeDialog } = useDialogContext();
    const form = useForm<RestApiKeyCreateModel>({
        resolver: zodResolver(restApiKeyCreateZodModel),
        defaultValues: { name: '', expiresAt: null },
    });

    const onSubmit = async (data: RestApiKeyCreateModel) => {
        const result = await Toast.fromAction(() => createRestApiKey(undefined, data));
        const rawApiKey = (result.data as any)?.rawApiKey;
        if (rawApiKey) {
            closeDialog(true);
            onCreated(rawApiKey);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Create REST API Key</h3>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Name of the key" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="expiresAt"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Expires At (optional)</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? format(field.value, "PPP") : "Pick a date"}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ?? undefined}
                                            onSelect={(date) => field.onChange(date ?? null)}
                                            disabled={(date) => date < new Date()}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={() => closeDialog()}>Cancel</Button>
                        <Button type="submit">Create</Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
