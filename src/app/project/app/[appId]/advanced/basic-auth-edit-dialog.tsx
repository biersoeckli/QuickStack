'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Form,
  FormControl,
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
import { AppBasicAuth, AppFileMount } from "@prisma/client"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { toast } from "sonner"
import { AppExtendedModel } from "@/shared/model/app-extended.model"
import { Textarea } from "@/components/ui/textarea"
import { BasicAuthEditModel, basicAuthEditZodModel } from "@/shared/model/basic-auth-edit.model"
import { saveBasicAuth } from "./actions"
import { z } from "zod"


const accessModes = [
  { label: "ReadWriteOnce", value: "ReadWriteOnce" },
  { label: "ReadWriteMany", value: "ReadWriteMany" },
] as const

export default function BasicAuthEditDialog({
  children,
  basicAuth,
  app
}: {
  children: React.ReactNode;
  basicAuth?: AppBasicAuth;
  app: AppExtendedModel;
}) {

  const [isOpen, setIsOpen] = useState<boolean>(false);


  const form = useForm<BasicAuthEditModel>({
    resolver: zodResolver(basicAuthEditZodModel.merge(z.object({
      appId: z.string().nullish()
    }))),
    defaultValues: {
      ...basicAuth,
    }
  });

  const [state, formAction] = useFormState((state: ServerActionResult<any, any>, payload: BasicAuthEditModel) =>
    saveBasicAuth(state, {
      ...payload,
      appId: app.id,
      id: basicAuth?.id
    }), FormUtils.getInitialFormState<typeof basicAuthEditZodModel>());

  useEffect(() => {
    if (state.status === 'success') {
      form.reset();
      toast.success('Authentication information saved successfully', {
        description: "Click \"deploy\" to apply the changes to your app.",
      });
      setIsOpen(false);
    }
    FormUtils.mapValidationErrorsToForm<typeof basicAuthEditZodModel>(state, form);
  }, [state]);

  useEffect(() => {
    form.reset(basicAuth);
  }, [basicAuth, app]);

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Basic Authentication</DialogTitle>
            <DialogDescription>
              Configure basic authentication to secure your app.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form action={(e) => form.handleSubmit((data) => {
              return formAction(data);
            }, console.error)()}>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
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