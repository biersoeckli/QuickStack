'use client'

import { FieldValues, UseFormReturn } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";


export default function SelectFormField<TFormType extends FieldValues>(
    {
        form,
        label,
        name,
        values,
        placeholder,
        formDescription,
        onValueChange
    }: {
        form: UseFormReturn<TFormType, any, undefined>;
        label: string | React.ReactNode;
        name: keyof TFormType;
        values: [string, string][];
        placeholder?: string;
        formDescription?: string | React.ReactNode;
        onValueChange?: (value: string) => void;
    }
) {

    return (<>
        <div className="hidden">
            <FormField
                control={form.control}
                name={name as any}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{label}</FormLabel>
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
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <Select disabled={field.disabled}
                        onValueChange={(val) => {
                            if (val) {
                                form.setValue(name as any, val as any);
                                if (onValueChange) {
                                    onValueChange(val);
                                }
                            }
                        }} defaultValue={field.value ?? undefined}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {values.map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {formDescription && <FormDescription>
                        {formDescription}
                    </FormDescription>}
                    <FormMessage />
                </FormItem>
            )}
        />
    </>)
}