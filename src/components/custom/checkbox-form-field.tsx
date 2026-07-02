'use client'

import { FieldValues, UseFormReturn } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input";
import { Checkbox } from "../ui/checkbox";


export default function CheckboxFormField<TFormType extends FieldValues>(
    {
        form,
        label,
        name
    }: {
        form: UseFormReturn<TFormType, any, TFormType>,
        label: string
        name: keyof TFormType
    }
) {

    return (<>
        <div className="hidden">
            <FormField
                control={form.control}
                name={name as any}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{name as any}</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <FormField
            control={form.control}
            name={name as any}
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Checkbox
                            disabled={field.disabled}
                            checked={field.value}
                            onCheckedChange={(checkboxState) => {
                                form.setValue(name as any, (checkboxState === true) as any)
                            }}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>
                            {label}
                        </FormLabel>
                    </div>
                </FormItem>
            )}
        />
    </>)
}
