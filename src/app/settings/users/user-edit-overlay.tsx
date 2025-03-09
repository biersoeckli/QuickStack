'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { S3Target, User } from "@prisma/client"
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserEditModel, userEditZodModel } from "@/shared/model/user-edit.model"
import { UserExtended } from "@/shared/model/user-extended.model"
import { saveUser } from "./actions"
import SelectFormField from "@/components/custom/select-form-field"
import { RoleExtended } from "@/shared/model/role-extended.model.ts"


export default function UserEditOverlay({ children, user, roles }: {
  children: React.ReactNode;
  roles: RoleExtended[];
  user?: UserExtended;
}) {

  const [isOpen, setIsOpen] = useState<boolean>(false);


  const form = useForm<UserEditModel>({
    resolver: zodResolver(userEditZodModel),
    defaultValues: user
  });

  const [state, formAction] = useFormState((state: ServerActionResult<any, any>,
    payload: UserEditModel) =>
    saveUser(state, {
      ...payload,
      id: user?.id
    }), FormUtils.getInitialFormState<typeof userEditZodModel>());

  useEffect(() => {
    if (state.status === 'success') {
      form.reset();
      toast.success('User saved successfully');
      setIsOpen(false);
    }
    FormUtils.mapValidationErrorsToForm<typeof userEditZodModel>(state, form);
  }, [state]);

  useEffect(() => {
    if (user) {
      form.reset(user);
    }
  }, [user]);

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{user?.id ? 'Edit' : 'Create'} User</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-2">
              <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                  return formAction(data);
                })()}>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Mail</FormLabel>
                          <FormControl>
                            <Input placeholder="" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <SelectFormField
                      form={form}
                      name="roleId"
                      label="Role"
                      formDescription={<>
                        Choose a preconfigured role or create your own in the settings.
                      </>}
                      values={roles.map((role) =>
                        [role.id, `${role.name}`])}
                    />

                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password {user?.id && <>(optional)</>}</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormDescription>
                            {user?.id && <>Leave empty to keep the old password.</>}
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
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )



}