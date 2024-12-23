'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/frontend/utils/utils"
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useFormState } from 'react-dom'
import { useEffect, useState } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AppVolume } from "@prisma/client"
import { AppVolumeEditModel, appVolumeEditZodModel } from "@/shared/model/volume-edit.model"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { saveVolume } from "./actions"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons"
import { AppExtendedModel } from "@/shared/model/app-extended.model"

const accessModes = [
  { label: "ReadWriteOnce", value: "ReadWriteOnce" },
  { label: "ReadWriteMany", value: "ReadWriteMany" },
] as const

export default function DialogEditDialog({ children, volume, app }: { children: React.ReactNode; volume?: AppVolume; app: AppExtendedModel; }) {

  const [isOpen, setIsOpen] = useState<boolean>(false);


  const form = useForm<AppVolumeEditModel>({
    resolver: zodResolver(appVolumeEditZodModel),
    defaultValues: {
      ...volume,
      accessMode: volume?.accessMode ?? (app.replicas > 1 ? "ReadWriteMany" : "ReadWriteOnce")
    }
  });

  const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: AppVolumeEditModel) =>
    saveVolume(state, {
      ...payload,
      appId: app.id,
      id: volume?.id
    }), FormUtils.getInitialFormState<typeof appVolumeEditZodModel>());

  useEffect(() => {
    if (state.status === 'success') {
      form.reset();
      toast.success('Volume saved successfully', {
        description: "Click \"deploy\" to apply the changes to your app.",
      });
      setIsOpen(false);
    }
    FormUtils.mapValidationErrorsToForm<typeof appVolumeEditZodModel>(state, form);
  }, [state]);

  useEffect(() => {
    form.reset(volume);
  }, [volume]);

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Volume</DialogTitle>
            <DialogDescription>
              Configure your custom volume for this container.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form action={(e) => form.handleSubmit((data) => {
              return formAction(data);
            })()}>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="containerMountPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mount Path Container</FormLabel>
                      <FormControl>
                        <Input placeholder="ex. /data" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size in MB</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="ex. 20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accessMode"
                  disabled={!!volume}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex gap-2">
                        <div>Access Mode</div>
                        <div className="self-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild><QuestionMarkCircledIcon /></TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[350px]">
                                  In most cases you will want to use ReadWriteOnce.
                                  This means that the volume can be mounted only by a single container instance.<br /><br />
                                  If you want to run multiple instances/replicas of the same container, you will need to use ReadWriteMany.
                                  This will allow multiple container instances to use the same storage on the same volume.<br /><br />
                                  After creation the access mode cannot be changed.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={!!volume}
                              className={cn(
                                "w-[200px] justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? accessModes.find(
                                  (accessMode) => accessMode.value === field.value
                                )?.label
                                : "Select accessMode"}
                              <ChevronsUpDown className="opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandList>
                              <CommandGroup>
                                {accessModes.map((accessMode) => (
                                  <CommandItem
                                    value={accessMode.label}
                                    key={accessMode.value}
                                    onSelect={() => {
                                      form.setValue("accessMode", accessMode.value)
                                    }}
                                  >
                                    {accessMode.label}
                                    <Check
                                      className={cn(
                                        "ml-auto",
                                        accessMode.value === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        This cannot be changed after creation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-red-500">{state.message}</p>
                <SubmitButton>Save</SubmitButton>
              </div>
            </form>
          </Form >
        </DialogContent>
      </Dialog>
    </>
  )



}