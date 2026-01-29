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
import { useEffect, useMemo, useState } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AppVolume } from "@prisma/client"
import { AppVolumeEditModel, appVolumeEditZodModel } from "@/shared/model/volume-edit.model"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { getShareableVolumes, saveVolume } from "./actions"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons"
import { AppExtendedModel } from "@/shared/model/app-extended.model"
import { NodeInfoModel } from "@/shared/model/node-info.model"
import { Checkbox } from "@/components/ui/checkbox"

const accessModes = [
  { label: "ReadWriteOnce", value: "ReadWriteOnce" },
  { label: "ReadWriteMany", value: "ReadWriteMany" },
] as const

const storageClasses = [
  { label: "Longhorn (Default)", value: "longhorn", description: "Distributed, replicated storage recommended workloads in a cluster of multiple nodes." },
  { label: "Local Path", value: "local-path", description: "Node-local volumes, no replication. Data is stored on the master node. Only works in a single node setup." }
] as const

type AppVolumeWithSharing = AppVolume & { sharedVolumeId?: string | null; shareWithOtherApps?: boolean };

export default function DialogEditDialog({ children, volume, app, nodesInfo }: {
  children: React.ReactNode;
  volume?: AppVolumeWithSharing;
  app: AppExtendedModel;
  nodesInfo: NodeInfoModel[];
}) {

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [useExistingVolume, setUseExistingVolume] = useState(false);
  const [shareableVolumes, setShareableVolumes] = useState<{ id: string; containerMountPath: string; size: number; storageClassName: string; accessMode: string; app: { name: string } }[]>([]);


  const form = useForm<AppVolumeEditModel>({
    resolver: zodResolver(appVolumeEditZodModel),
    defaultValues: {
      ...volume,
      accessMode: volume?.accessMode ?? (app.replicas > 1 ? "ReadWriteMany" : "ReadWriteOnce"),
      storageClassName: (volume?.storageClassName ?? "longhorn") as 'longhorn' | 'local-path',
      shareWithOtherApps: volume?.shareWithOtherApps ?? false,
      sharedVolumeId: volume?.sharedVolumeId ?? null,
    }
  });

  const selectedAccessMode = form.watch("accessMode");
  const selectedSharedVolumeId = form.watch("sharedVolumeId");
  const selectedSharedVolume = useMemo(() => shareableVolumes.find(item => item.id === selectedSharedVolumeId), [shareableVolumes, selectedSharedVolumeId]);
  const hasShareableVolumes = shareableVolumes.length > 0;

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
      storageClassName: (volume?.storageClassName ?? "longhorn") as 'longhorn' | 'local-path',
      shareWithOtherApps: volume?.shareWithOtherApps ?? false,
      sharedVolumeId: volume?.sharedVolumeId ?? null,
    });
    setUseExistingVolume(false);
  }, [volume]);

  useEffect(() => {
    if (!isOpen || volume) {
      return;
    }
    const loadShareableVolumes = async () => {
      const response = await getShareableVolumes(app.id);
      if (response.status === 'success' && response.data) {
        setShareableVolumes(response.data);
      } else {
        setShareableVolumes([]);
      }
    };
    loadShareableVolumes();
  }, [app.id, isOpen, volume]);

  useEffect(() => {
    if (!useExistingVolume) {
      form.setValue("sharedVolumeId", null);
      return;
    }
    if (selectedSharedVolume) {
      form.setValue("size", selectedSharedVolume.size);
      form.setValue("accessMode", selectedSharedVolume.accessMode);
      form.setValue("storageClassName", selectedSharedVolume.storageClassName as 'longhorn' | 'local-path');
      form.setValue("shareWithOtherApps", false);
    }
  }, [form, selectedSharedVolume, useExistingVolume]);

  useEffect(() => {
    if (!useExistingVolume || selectedSharedVolumeId) {
      return;
    }
    if (shareableVolumes.length > 0) {
      form.setValue("sharedVolumeId", shareableVolumes[0].id);
    }
  }, [form, selectedSharedVolumeId, shareableVolumes, useExistingVolume]);

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
                {!volume && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-existing-volume"
                      checked={useExistingVolume}
                      onCheckedChange={(checked) => setUseExistingVolume(!!checked)}
                      disabled={!hasShareableVolumes}
                    />
                    <FormLabel htmlFor="use-existing-volume">Use existing shared volume</FormLabel>
                  </div>
                )}
                {!volume && !hasShareableVolumes && (
                  <p className="text-xs text-muted-foreground">
                    No shared volumes are available from other apps in this project.
                  </p>
                )}
                {!volume && useExistingVolume && (
                  <FormField
                    control={form.control}
                    name="sharedVolumeId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Shared Volume</FormLabel>
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
                              >
                                {selectedSharedVolume
                                  ? `${selectedSharedVolume.app.name} · ${selectedSharedVolume.containerMountPath}`
                                  : "Select a shared volume"}
                                <ChevronsUpDown className="opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="max-w-[320px] p-0">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  {shareableVolumes.map((shareableVolume) => (
                                    <CommandItem
                                      value={`${shareableVolume.app.name}-${shareableVolume.containerMountPath}`}
                                      key={shareableVolume.id}
                                      onSelect={() => {
                                        form.setValue("sharedVolumeId", shareableVolume.id);
                                      }}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <span>{shareableVolume.app.name}</span>
                                        <span className="text-xs text-muted-foreground">{shareableVolume.containerMountPath} · {shareableVolume.size} MB</span>
                                      </div>
                                      <Check
                                        className={cn(
                                          "ml-auto",
                                          shareableVolume.id === field.value
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
                          Select a ReadWriteMany volume shared by another app in this project.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                        <Input type="number" placeholder="ex. 20" {...field} disabled={useExistingVolume || !!volume?.sharedVolumeId} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accessMode"
                  disabled={!!volume || useExistingVolume || !!volume?.sharedVolumeId}
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
                {!useExistingVolume && !volume?.sharedVolumeId && selectedAccessMode === 'ReadWriteMany' && (
                  <FormField
                    control={form.control}
                    name="shareWithOtherApps"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value ?? false}
                              onCheckedChange={(checked) => field.onChange(!!checked)}
                            />
                          </FormControl>
                          <FormLabel>Share with other apps in project</FormLabel>
                        </div>
                        <FormDescription>
                          Allow other apps in this project to mount this volume at their own paths.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {nodesInfo.length === 1 &&
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
                                    <b>Longhorn</b> keeps data replicated across nodes.<br />
                                    <b>Local Path</b> stores data on a the master node and works only in single-node clusters.
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
                                disabled={!!volume || useExistingVolume || !!volume?.sharedVolumeId}
                              >
                                {field.value
                                  ? storageClasses.find(
                                    (storageClass) => storageClass.value === field.value
                                  )?.label
                                  : "Select storage class"}
                                <ChevronsUpDown className="opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="max-w-[280px] p-0">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  {storageClasses.map((storageClass) => (
                                    <CommandItem
                                      value={storageClass.label}
                                      key={storageClass.value}
                                      onSelect={() => {
                                        form.setValue("storageClassName", storageClass.value);
                                      }}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <span>{storageClass.label}</span>
                                        <span className="text-xs text-muted-foreground">{storageClass.description}</span>
                                      </div>
                                      <Check
                                        className={cn(
                                          "ml-auto",
                                          storageClass.value === field.value
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
                  />}
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
