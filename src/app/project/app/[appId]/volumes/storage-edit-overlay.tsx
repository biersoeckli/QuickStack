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
import { NodeInfoModel } from "@/shared/model/node-info.model"
import { StorageClassInfoModel } from "@/shared/model/storage-class-info.model"
import CheckboxFormField from "@/components/custom/checkbox-form-field"

const accessModes = [
  { label: "ReadWriteOnce", value: "ReadWriteOnce" },
  { label: "ReadWriteMany", value: "ReadWriteMany" },
] as const

export default function StorageEditDialog({ children, volume, app, nodesInfo, storageClasses }: {
  children: React.ReactNode;
  volume?: AppVolume;
  app: AppExtendedModel;
  nodesInfo: NodeInfoModel[];
  storageClasses: StorageClassInfoModel[];
}) {

  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Filter out local-path in multi-node clusters; on single-node all classes are available
  const availableStorageClasses = nodesInfo.length > 1
    ? storageClasses.filter(sc => sc.name !== 'local-path')
    : storageClasses;

  const resolveDefaultStorageClass = () => {
    if (availableStorageClasses.find(sc => sc.name === 'longhorn')) return 'longhorn';
    const defaultSc = availableStorageClasses.find(sc => sc.isDefault);
    if (defaultSc) return defaultSc.name;
    return availableStorageClasses[0]?.name ?? 'longhorn';
  };

  const form = useForm<AppVolumeEditModel>({
    resolver: zodResolver(appVolumeEditZodModel),
    defaultValues: {
      containerMountPath: volume?.containerMountPath ?? '',
      size: volume?.size ?? 0,
      accessMode: volume?.accessMode ?? (app.replicas > 1 ? "ReadWriteMany" : "ReadWriteOnce"),
      storageClassName: (volume?.storageClassName ?? resolveDefaultStorageClass()) as string,
      shareWithOtherApps: volume?.shareWithOtherApps ?? false,
      sharedVolumeId: volume?.sharedVolumeId ?? undefined,
    }
  });

  // Watch accessMode to conditionally show shareWithOtherApps checkbox
  const watchedAccessMode = form.watch("accessMode");
  const watchedStorageClassName = form.watch("storageClassName");
  const supportsRWX = watchedStorageClassName === 'longhorn';
  const canBeShared = (!!volume ? volume.accessMode : watchedAccessMode === "ReadWriteMany") &&
    supportsRWX &&
    !volume?.sharedVolumeId;

  // Auto-switch ReadWriteMany → ReadWriteOnce when selected class doesn't support it
  useEffect(() => {
    if (!supportsRWX && watchedAccessMode === 'ReadWriteMany') {
      form.setValue('accessMode', 'ReadWriteOnce');
    }
  }, [watchedStorageClassName]);

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
    form.reset({
      ...volume,
      accessMode: volume?.accessMode ?? (app.replicas > 1 ? "ReadWriteMany" : "ReadWriteOnce"),
      storageClassName: (volume?.storageClassName ?? resolveDefaultStorageClass()) as string,
      shareWithOtherApps: volume?.shareWithOtherApps ?? false,
      sharedVolumeId: volume?.sharedVolumeId ?? undefined,
    });
  }, [volume]);

  const values = form.watch();

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

                {volume && volume.size !== values.size && volume.shareWithOtherApps && <>
                  <p className="text-sm text-yellow-600">
                    When changing the size of a shared volume, ensure that all apps using this volume are shut down before deploying the changes.
                  </p>
                </>}

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
                                  ReadWriteMany is only supported by the <b>Longhorn</b> storage class.<br /><br />
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
                                    disabled={accessMode.value === 'ReadWriteMany' && !supportsRWX}
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
                <FormField
                    control={form.control}
                    name="storageClassName"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex gap-2">
                          <div>Storage Class</div>
                          <div className="self-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild><QuestionMarkCircledIcon /></TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[350px]">
                                    Choose where the volume is provisioned.<br /><br />
                                    <b>Longhorn</b> keeps data replicated across nodes and supports ReadWriteMany.<br />
                                    <b>Local Path</b> stores data on the master node and works only in single-node clusters.<br /><br />
                                    Only <b>Longhorn</b> supports the ReadWriteMany access mode.
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
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={!!volume}
                              >
                                {field.value
                                  ? (field.value) + (availableStorageClasses.find(sc => sc.name === field.value)?.isDefault ? ' (Default)' : '')
                                  : "Select storage class"}
                                <ChevronsUpDown className="opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="max-w-[280px] p-0">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  {availableStorageClasses.map((sc) => (
                                    <CommandItem
                                      value={sc.name}
                                      key={sc.name}
                                      onSelect={() => {
                                        form.setValue("storageClassName", sc.name);
                                      }}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <span>{sc.name}{sc.isDefault ? ' (Default)' : ''}</span>
                                      </div>
                                      <Check
                                        className={cn(
                                          "ml-auto",
                                          sc.name === field.value
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
                {canBeShared && (
                  <CheckboxFormField
                    form={form}
                    name="shareWithOtherApps"
                    label="Allow other apps to attach this volume"
                  />
                )}
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
