"use client"

import * as React from "react"
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ControllerRenderProps, FieldValues, UseFormReturn } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel } from "../ui/form"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"

type Checked = DropdownMenuCheckboxItemProps["checked"]

export function MultiselectDropdownField<TFormType extends FieldValues>(
  {
    form,
    label,
    name,
    options
  }: {
    form: UseFormReturn<TFormType, any, TFormType>,
    label: string | React.ReactNode,
    name: keyof TFormType
    options: string[]
  }
) {

  const [values, setValues] = React.useState<Map<string, boolean>>(new Map<string, boolean>())


  React.useEffect(() => {
    const values = form.getValues();
    const fieldValue = values[name] as string;
    const selectedValue = (fieldValue || "").split(",");
    const selectedOptions = new Map<string, boolean>()
    for (const option of options) {
      selectedOptions.set(option, selectedValue.includes(option))
    }
    setValues(selectedOptions);
  }, [form, options, name]);



  return <>
    <div className="hidden">
      <FormField
        control={form.control}
        name={name as any}
        render={({ field }) => (
          <FormItem>
            <FormLabel>id</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{!(form.getValues()[name] as string) || (form.getValues()[name] as string).length === 0 ? label : (form.getValues()[name] as string)?.replaceAll(',', ', ')}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Kantone</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-60">
          {Array.from(values.entries()).map(([key, value]) => {
            return <DropdownMenuCheckboxItem
              key={key}
              checked={values.get(key)}
              onCheckedChange={(checked) => {
                setValues(new Map(values.set(key, checked)));
                const value = Array.from(values.entries()).filter(([_, value]) => value).map(([key]) => key).join(",");
                form.setValue(name as any, value as any);
              }}
            >
              {key}
            </DropdownMenuCheckboxItem>
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  </>;
}
