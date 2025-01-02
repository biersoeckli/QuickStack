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
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useFormState } from 'react-dom'
import { useEffect, useState } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AppVolume, S3Target, VolumeBackup } from "@prisma/client"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { saveBackupVolume } from "./actions"
import { toast } from "sonner"
import { VolumeBackupEditModel, volumeBackupEditZodModel } from "@/shared/model/backup-volume-edit.model"
import SelectFormField from "@/components/custom/select-form-field"
import Link from "next/link"

export default function VolumeBackupEditDialog({
  children,
  volumeBackup,
  s3Targets,
  volumes
}: {
  children: React.ReactNode;
  volumeBackup?: VolumeBackup;
  s3Targets: S3Target[];
  volumes: AppVolume[];
}) {

  const [isOpen, setIsOpen] = useState<boolean>(false);

  const form = useForm<VolumeBackupEditModel>({
    resolver: zodResolver(volumeBackupEditZodModel),
    defaultValues: {
      ...volumeBackup,
      retention: volumeBackup?.retention || 5,
      targetId: volumeBackup?.targetId || (s3Targets.length === 1 ? s3Targets[0].id : undefined),
      volumeId: volumeBackup?.volumeId || (volumes.length === 1 ? volumes[0].id : undefined),
    }
  });

  const [state, formAction] = useFormState((state: ServerActionResult<any, any>,
    payload: VolumeBackupEditModel) =>
    saveBackupVolume(state, {
      ...payload
    }), FormUtils.getInitialFormState<typeof volumeBackupEditZodModel>());

  useEffect(() => {
    if (state.status === 'success') {
      form.reset();
      toast.success('Volume Backup saved successfully', {
        description: "From now on the volume will be backed up according to the new settings.",
      });
      setIsOpen(false);
    }
    FormUtils.mapValidationErrorsToForm<typeof volumeBackupEditZodModel>(state, form);
  }, [state]);

  useEffect(() => {
    form.reset(volumeBackup);
  }, [volumeBackup]);

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Backup Configuration</DialogTitle>
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
                  name="cron"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cron expression</FormLabel>
                      <FormControl>
                        <Input placeholder="5 4 * * *" {...field} />
                      </FormControl>
                      <FormDescription>
                        To learn more about cron expressions, visit <a href="https://crontab.guru/" target="_blank" className="underline">crontab.guru</a>.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="retention"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retention</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="5" {...field} />
                      </FormControl>
                      <FormDescription>
                        The number of backups to keep.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <SelectFormField
                  form={form}
                  name="volumeId"
                  label="Volume to backup"
                  values={volumes.map((volume) =>
                    [volume.id, `${volume.containerMountPath}`])}
                />

                <SelectFormField
                  form={form}
                  name="targetId"
                  label="Backup Location"
                  formDescription={<>
                    S3 Storage Locations can be configured <span className="underline"><Link href="/settings/s3-targets">here</Link></span>.
                  </>}
                  values={s3Targets.map((target) =>
                    [target.id, `${target.name}`])}
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