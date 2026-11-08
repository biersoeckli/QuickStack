'use client'

import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

import { useActionState, useEffect } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { AppBasicAuth } from "@prisma/client"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { toast } from "sonner"
import { AppExtendedModel } from "@/shared/model/app-extended.model"
import { BasicAuthEditModel, basicAuthEditZodModel } from "@/shared/model/basic-auth-edit.model"
import { saveBasicAuth } from "./actions"
import { z } from "zod"
import { useDialog } from '@/frontend/states/zustand.states';


export default function BasicAuthEditDialog({
  basicAuth,
  app
}: {
  basicAuth?: AppBasicAuth;
  app: AppExtendedModel;
}) {

  const { closeDialog } = useDialog();
  const form = useForm<z.input<typeof basicAuthEditZodModel>, unknown, z.output<typeof basicAuthEditZodModel>>({
    resolver: zodResolver(basicAuthEditZodModel),
    defaultValues: {
      ...basicAuth,
      appId: app.id,
    }
  });

  const [state, formAction] = useActionState((state: ServerActionResult<any, any>, payload: BasicAuthEditModel) =>
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
      closeDialog();
    }
    FormUtils.mapValidationErrorsToForm<typeof basicAuthEditZodModel>(state, form);
  }, [closeDialog, form, state]);

  useEffect(() => {
    form.reset(basicAuth);
  }, [basicAuth, app, form]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Basic Authentication</DialogTitle>
        <DialogDescription>
          Configure basic authentication to secure your app.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
            <form action={() => form.handleSubmit((data) => {
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
    </>
  )



}
