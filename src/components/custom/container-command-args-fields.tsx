'use client';

import { type ReactNode } from "react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function LabelWithHint({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
    return (
        <div className="flex items-center gap-1.5">
            <FormLabel className="m-0">{children}</FormLabel>
            {hint && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        >
                            <HelpCircle className="h-3.5 w-3.5" />
                            <span className="sr-only">More information</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-80">
                        <div className="text-sm leading-relaxed">{hint}</div>
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

export default function ContainerCommandArgsFields({
    form,
    readonly,
    commandHint = "Overrides the image ENTRYPOINT. Leave empty to keep the command defined by the container image.",
    argsHint = "Overrides the image CMD. Add one item per argument in the order the process should receive them.",
}: {
    form: UseFormReturn<any>;
    readonly: boolean;
    commandHint?: ReactNode;
    argsHint?: ReactNode;
}) {
    return (
        <>
            <ContainerStringArrayField
                form={form}
                readonly={readonly}
                name="containerCommand"
                label="Command"
                emptyLabel="No command configured."
                addLabel="Add Command"
                placeholderPrefix="Command"
                hint={commandHint}
            />

            <ContainerStringArrayField
                form={form}
                readonly={readonly}
                name="containerArgs"
                label="Arguments"
                emptyLabel="No arguments configured."
                addLabel="Add Argument"
                placeholderPrefix="Argument"
                hint={argsHint}
            />
        </>
    );
}

function ContainerStringArrayField({
    form,
    readonly,
    name,
    label,
    emptyLabel,
    addLabel,
    placeholderPrefix,
    hint,
}: {
    form: UseFormReturn<any>;
    readonly: boolean;
    name: string;
    label: string;
    emptyLabel: string;
    addLabel: string;
    placeholderPrefix: string;
    hint?: ReactNode;
}) {
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name,
    });

    return (
        <div className="space-y-3">
            <LabelWithHint hint={hint}>{label}</LabelWithHint>

            <div className="space-y-2">
                {fields.length === 0 && (
                    <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        {emptyLabel}
                    </div>
                )}

                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2">
                        <FormField
                            control={form.control}
                            name={`${name}.${index}.value`}
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                        <Input
                                            placeholder={`${placeholderPrefix} ${index + 1}`}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-0"
                            onClick={() => remove(index)}
                            disabled={readonly}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            {!readonly && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ value: '' })}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    {addLabel}
                </Button>
            )}
        </div>
    );
}
